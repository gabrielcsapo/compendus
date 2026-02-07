//
//  ComicReaderView.swift
//  Compendus
//
//  Comic reader for CBR/CBZ files with local extraction support for offline reading
//  CBZ files can be read offline, CBR files require server connection
//

import SwiftUI
import SwiftData

struct ComicReaderView: View {
    let book: DownloadedBook

    @Environment(\.modelContext) private var modelContext
    @Environment(APIService.self) private var apiService
    @Environment(StorageManager.self) private var storageManager
    @Environment(ComicExtractor.self) private var comicExtractor

    @State private var currentPage: Int = 0
    @State private var totalPages: Int = 0
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var showingControls = true
    @State private var currentPageImage: UIImage?
    @State private var isLoadingPage = false
    @State private var isOfflineMode = false

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color.black.ignoresSafeArea()

                if let error = errorMessage {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    }
                    .foregroundStyle(.white)
                } else if isLoading {
                    ProgressView("Loading comic...")
                        .foregroundStyle(.white)
                        .tint(.white)
                } else {
                    // Page view with gestures
                    ZStack {
                        if let image = currentPageImage {
                            Image(uiImage: image)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(maxWidth: geometry.size.width, maxHeight: geometry.size.height)
                        } else if isLoadingPage {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "photo")
                                .font(.largeTitle)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 50)
                            .onEnded { value in
                                if value.translation.width < -50 {
                                    // Swipe left - next page
                                    goToNextPage()
                                } else if value.translation.width > 50 {
                                    // Swipe right - previous page
                                    goToPreviousPage()
                                }
                            }
                    )
                    .onTapGesture { location in
                        let width = geometry.size.width
                        if location.x < width * 0.3 {
                            goToPreviousPage()
                        } else if location.x > width * 0.7 {
                            goToNextPage()
                        } else {
                            withAnimation {
                                showingControls.toggle()
                            }
                        }
                    }
                }

                // Controls overlay
                if showingControls && !isLoading && errorMessage == nil {
                    VStack {
                        // Offline indicator at top
                        if isOfflineMode {
                            HStack {
                                Image(systemName: "icloud.slash")
                                Text("Offline Mode")
                            }
                            .font(.caption)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(.ultraThinMaterial)
                            .clipShape(Capsule())
                            .padding(.top, 8)
                        }

                        Spacer()

                        VStack(spacing: 12) {
                            // Page slider
                            if totalPages > 1 {
                                Slider(
                                    value: Binding(
                                        get: { Double(currentPage) },
                                        set: { newValue in
                                            let page = Int(newValue)
                                            if page != currentPage {
                                                currentPage = page
                                                Task { await loadPage(page) }
                                            }
                                        }
                                    ),
                                    in: 0...Double(max(0, totalPages - 1)),
                                    step: 1
                                )
                                .tint(.white)
                            }

                            // Page indicator
                            Text("Page \(currentPage + 1) of \(totalPages)")
                                .font(.subheadline)
                                .foregroundStyle(.white)
                        }
                        .padding()
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding()
                    }
                }
            }
        }
        .navigationTitle(book.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task {
            await loadComic()
        }
        .onDisappear {
            saveProgress()
        }
    }

    private func loadComic() async {
        isLoading = true
        errorMessage = nil

        // Check if we can use local extraction
        let canExtractLocally = comicExtractor.supportsLocalExtraction(format: book.format)
        let hasLocalFile = book.fileURL != nil && FileManager.default.fileExists(atPath: book.fileURL!.path)

        if canExtractLocally && hasLocalFile {
            // Use local extraction for CBZ
            await loadComicLocally()
        } else if book.format.lowercased() == "cbr" && hasLocalFile {
            // CBR downloaded but needs server for extraction
            // Try server first, but inform user about limitation
            await loadComicFromServer()
        } else {
            // No local file or unsupported format - use server
            await loadComicFromServer()
        }
    }

    private func loadComicLocally() async {
        guard let fileURL = book.fileURL else {
            errorMessage = "Book file not found"
            isLoading = false
            return
        }

        do {
            // Get page count from local file
            totalPages = try comicExtractor.getPageCount(from: fileURL, format: book.format)

            if totalPages == 0 {
                errorMessage = "Comic has no pages"
                isLoading = false
                return
            }

            // Cache page count for future use
            if book.pageCount != totalPages {
                book.pageCount = totalPages
                try? modelContext.save()
            }

            // Restore last position
            if let lastPosition = book.lastPosition, let page = Int(lastPosition) {
                currentPage = min(page, totalPages - 1)
            }

            isOfflineMode = true
            isLoading = false

            // Load initial page
            await loadPage(currentPage)
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    private func loadComicFromServer() async {
        do {
            // Get page count from server
            let info = try await apiService.fetchComicInfo(bookId: book.id, format: book.format)
            totalPages = info.pageCount

            if totalPages == 0 {
                errorMessage = "Comic has no pages"
                isLoading = false
                return
            }

            // Cache page count
            if book.pageCount != totalPages {
                book.pageCount = totalPages
                try? modelContext.save()
            }

            // Restore last position
            if let lastPosition = book.lastPosition, let page = Int(lastPosition) {
                currentPage = min(page, totalPages - 1)
            }

            isOfflineMode = false
            isLoading = false

            // Load initial page
            await loadPage(currentPage)
        } catch {
            // If server fails and we have a CBR file, show specific message
            if book.format.lowercased() == "cbr" {
                errorMessage = "CBR files require server connection for reading. Please connect to your server or download books in CBZ format for offline reading."
            } else {
                errorMessage = "Failed to load comic: \(error.localizedDescription)"
            }
            isLoading = false
        }
    }

    private func loadPage(_ page: Int) async {
        isLoadingPage = true
        currentPageImage = nil

        // Check local cache first
        if let cachedData = storageManager.getCachedComicPage(bookId: book.id, page: page),
           let image = UIImage(data: cachedData) {
            currentPageImage = image
            isLoadingPage = false
            return
        }

        // Try local extraction for CBZ
        let canExtractLocally = comicExtractor.supportsLocalExtraction(format: book.format)
        let hasLocalFile = book.fileURL != nil && FileManager.default.fileExists(atPath: book.fileURL!.path)

        if canExtractLocally && hasLocalFile {
            await loadPageLocally(page)
        } else {
            await loadPageFromServer(page)
        }
    }

    private func loadPageLocally(_ page: Int) async {
        guard let fileURL = book.fileURL else {
            isLoadingPage = false
            return
        }

        do {
            let data = try comicExtractor.extractPage(from: fileURL, format: book.format, pageIndex: page)
            if let image = UIImage(data: data) {
                currentPageImage = image

                // Cache for faster access next time
                try? storageManager.cacheComicPage(bookId: book.id, page: page, data: data)
            }
        } catch {
            print("Failed to extract page \(page) locally: \(error)")
            // Try server as fallback
            await loadPageFromServer(page)
        }

        isLoadingPage = false
    }

    private func loadPageFromServer(_ page: Int) async {
        do {
            let data = try await apiService.fetchComicPage(bookId: book.id, format: book.format, page: page)
            if let image = UIImage(data: data) {
                currentPageImage = image

                // Cache for offline use
                try? storageManager.cacheComicPage(bookId: book.id, page: page, data: data)
            }
        } catch {
            print("Failed to load page \(page) from server: \(error)")
        }

        isLoadingPage = false
    }

    private func goToNextPage() {
        guard currentPage < totalPages - 1 else { return }
        currentPage += 1
        Task { await loadPage(currentPage) }
    }

    private func goToPreviousPage() {
        guard currentPage > 0 else { return }
        currentPage -= 1
        Task { await loadPage(currentPage) }
    }

    private func saveProgress() {
        book.lastPosition = String(currentPage)
        book.readingProgress = totalPages > 0 ? Double(currentPage + 1) / Double(totalPages) : 0
        book.lastReadAt = Date()
        try? modelContext.save()
    }
}

#Preview {
    let book = DownloadedBook(
        id: "1",
        title: "Sample Comic",
        authors: ["Author"],
        format: "cbz",
        fileSize: 50000000,
        localPath: "books/1.cbz"
    )

    NavigationStack {
        ComicReaderView(book: book)
    }
    .environment(APIService(config: ServerConfig()))
    .environment(StorageManager())
    .environment(ComicExtractor())
    .modelContainer(for: DownloadedBook.self, inMemory: true)
}
