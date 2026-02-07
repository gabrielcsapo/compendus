//
//  BookDetailView.swift
//  Compendus
//
//  Detailed view of a book with download option
//

import SwiftUI
import SwiftData

struct BookDetailView: View {
    let book: Book

    @Environment(ServerConfig.self) private var serverConfig
    @Environment(APIService.self) private var apiService
    @Environment(DownloadManager.self) private var downloadManager
    @Environment(StorageManager.self) private var storageManager
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var isDownloading = false
    @State private var isDownloaded = false
    @State private var downloadError: String?
    @State private var showingError = false
    @State private var downloadedBook: DownloadedBook?
    @State private var bookToRead: DownloadedBook?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Cover and basic info
                    HStack(alignment: .top, spacing: 16) {
                        // Cover - only load if server has a cover
                        Group {
                            if book.coverUrl != nil {
                                AsyncImage(url: serverConfig.coverURL(for: book.id)) { phase in
                                    switch phase {
                                    case .empty:
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color.gray.opacity(0.2))
                                            .overlay { ProgressView() }
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fit)
                                    case .failure:
                                        coverPlaceholder
                                    @unknown default:
                                        EmptyView()
                                    }
                                }
                            } else {
                                coverPlaceholder
                            }
                        }
                        .frame(width: 120, height: 180)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .shadow(radius: 4)

                        // Info
                        VStack(alignment: .leading, spacing: 8) {
                            Text(book.title)
                                .font(.title2)
                                .fontWeight(.bold)

                            if let subtitle = book.subtitle {
                                Text(subtitle)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }

                            Text(book.authorsDisplay)
                                .font(.subheadline)

                            Spacer()

                            HStack(spacing: 8) {
                                formatBadge

                                Text(book.fileSizeDisplay)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            if book.isAudiobook {
                                if let duration = book.durationDisplay {
                                    Label(duration, systemImage: "clock")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                if let narrator = book.narrator {
                                    Label(narrator, systemImage: "person.wave.2")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            } else if let pageCount = book.pageCount {
                                Label("\(pageCount) pages", systemImage: "doc.text")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal)

                    // Download button
                    downloadButton
                        .padding(.horizontal)

                    // Description
                    if let description = book.description, !description.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Description")
                                .font(.headline)

                            Text(description)
                                .font(.body)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                    }

                    // Details section
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Details")
                            .font(.headline)

                        detailsGrid
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)

                    // Chapters for audiobooks
                    if book.isAudiobook, let chapters = book.chapters, !chapters.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Chapters")
                                .font(.headline)

                            ForEach(chapters) { chapter in
                                HStack {
                                    Text(chapter.title)
                                        .font(.subheadline)
                                    Spacer()
                                    Text(chapter.startTimeDisplay)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 4)
                                Divider()
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Book Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .task {
                checkIfDownloaded()
            }
            .alert("Download Failed", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(downloadError ?? "An error occurred while downloading the book.")
            }
            .fullScreenCover(item: $bookToRead) { book in
                ReaderContainerView(book: book)
                    .environment(apiService)
                    .environment(storageManager)
                    .modelContext(modelContext)
            }
        }
    }

    @ViewBuilder
    private var downloadButton: some View {
        AnimatedDownloadButton(
            state: downloadButtonState,
            onTap: {
                if isDownloaded {
                    bookToRead = downloadedBook
                } else {
                    downloadBook()
                }
            },
            onCancel: {
                downloadManager.cancelDownload(bookId: book.id)
                isDownloading = false
            }
        )
    }

    private var downloadButtonState: AnimatedDownloadButton.State {
        if isDownloaded {
            return .completed
        } else if isDownloading {
            let progress = downloadManager.activeDownloads[book.id]?.progress ?? 0
            return .downloading(progress: progress)
        } else if downloadError != nil {
            return .failed
        } else {
            return .idle
        }
    }

    @ViewBuilder
    private var formatBadge: some View {
        Text(book.formatDisplay)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(formatColor.opacity(0.2))
            .foregroundStyle(formatColor)
            .clipShape(Capsule())
    }

    private var formatColor: Color {
        switch book.format.lowercased() {
        case "epub":
            return .blue
        case "pdf":
            return .red
        case "mobi", "azw", "azw3":
            return .orange
        case "cbr", "cbz":
            return .purple
        case "m4b", "mp3", "m4a":
            return .green
        default:
            return .gray
        }
    }

    @ViewBuilder
    private var coverPlaceholder: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color.gray.opacity(0.2))
            .overlay {
                Image(systemName: "book.closed")
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
            }
    }

    @ViewBuilder
    private var detailsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 8) {
            if let publisher = book.publisher {
                DetailRow(label: "Publisher", value: publisher)
            }
            if let publishedDate = book.publishedDate {
                DetailRow(label: "Published", value: publishedDate)
            }
            if let isbn = book.isbn13 ?? book.isbn10 ?? book.isbn {
                DetailRow(label: "ISBN", value: isbn)
            }
            if let language = book.language {
                DetailRow(label: "Language", value: language.uppercased())
            }
            if let series = book.series {
                let value = book.seriesNumber != nil ? "\(series) #\(book.seriesNumber!)" : series
                DetailRow(label: "Series", value: value)
            }
        }
    }

    private func checkIfDownloaded() {
        downloadedBook = downloadManager.getDownloadedBook(id: book.id, modelContext: modelContext)
        isDownloaded = downloadedBook != nil
    }

    private func downloadBook() {
        isDownloading = true
        downloadError = nil

        Task {
            do {
                let downloaded = try await downloadManager.downloadBook(book, modelContext: modelContext)
                await MainActor.run {
                    isDownloading = false
                    isDownloaded = true
                    downloadedBook = downloaded
                }
            } catch {
                await MainActor.run {
                    isDownloading = false
                    downloadError = error.localizedDescription
                    showingError = true
                }
            }
        }
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline)
        }
    }
}

#Preview {
    let book = Book(
        id: "1",
        title: "Sample Book",
        subtitle: "A Subtitle",
        authors: ["Author Name"],
        publisher: "Publisher Name",
        publishedDate: "2024",
        description: "This is a sample book description that provides information about the content of the book.",
        isbn: nil,
        isbn10: nil,
        isbn13: "9781234567890",
        language: "en",
        pageCount: 300,
        format: "epub",
        series: "Sample Series",
        seriesNumber: "1",
        coverUrl: "/covers/1.jpg",
        addedAt: nil,
        fileSize: 1024000
    )

    let config = ServerConfig()
    let api = APIService(config: config)

    BookDetailView(book: book)
        .environment(config)
        .environment(api)
        .environment(DownloadManager(config: config, apiService: api))
        .environment(StorageManager())
        .modelContainer(for: DownloadedBook.self, inMemory: true)
}
