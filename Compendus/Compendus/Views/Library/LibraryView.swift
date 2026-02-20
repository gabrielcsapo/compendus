//
//  LibraryView.swift
//  Compendus
//
//  Browse books from the server library
//

import SwiftUI
import SwiftData

enum BookFilter: String, CaseIterable {
    case all = "All"
    case ebooks = "Ebooks"
    case audiobooks = "Audiobooks"
    case comics = "Comics"

    var icon: String {
        switch self {
        case .all: return "books.vertical"
        case .ebooks: return "book.closed"
        case .audiobooks: return "headphones"
        case .comics: return "book.pages"
        }
    }

    /// API type parameter for server-side filtering
    var apiType: String? {
        switch self {
        case .all: return nil
        case .ebooks: return "ebook"
        case .audiobooks: return "audiobook"
        case .comics: return "comic"
        }
    }
}

enum BookSort: String, CaseIterable {
    case recent = "Recently Added"
    case titleAsc = "Title A-Z"
    case titleDesc = "Title Z-A"
    case oldest = "Oldest First"

    var icon: String {
        switch self {
        case .recent: return "clock"
        case .titleAsc: return "textformat.abc"
        case .titleDesc: return "textformat.abc"
        case .oldest: return "calendar"
        }
    }

    /// API orderBy parameter
    var apiOrderBy: String {
        switch self {
        case .recent, .oldest: return "createdAt"
        case .titleAsc, .titleDesc: return "title"
        }
    }

    /// API order parameter
    var apiOrder: String {
        switch self {
        case .recent, .titleDesc: return "desc"
        case .titleAsc, .oldest: return "asc"
        }
    }
}

struct LibraryView: View {
    @Environment(APIService.self) private var apiService
    @Environment(ServerConfig.self) private var serverConfig
    @Environment(DownloadManager.self) private var downloadManager
    @Environment(ReaderSettings.self) private var readerSettings
    @Environment(\.modelContext) private var modelContext

    // Query for recently read books (for Continue Reading section)
    @Query(
        filter: #Predicate<DownloadedBook> { $0.lastReadAt != nil },
        sort: \DownloadedBook.lastReadAt,
        order: .reverse
    )
    private var recentlyReadBooks: [DownloadedBook]

    // Query for all downloaded books (to check download status)
    @Query private var downloadedBooks: [DownloadedBook]

    @State private var books: [Book] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var searchText = ""
    @State private var hasMore = true
    @State private var offset = 0
    @State private var totalCount: Int = 0
    @State private var selectedBook: Book?
    @State private var selectedFilter: BookFilter = .all
    @State private var selectedSort: BookSort = .recent
    @State private var bookToRead: DownloadedBook?
    @State private var downloadingBooks: Set<String> = []

    private let limit = 50
    private let columns = [
        GridItem(.adaptive(minimum: 160, maximum: 200), spacing: 16)
    ]

    var body: some View {
        NavigationStack {
            Group {
                if books.isEmpty && isLoading {
                    SkeletonBookGrid(count: 8)
                } else if books.isEmpty && errorMessage != nil {
                    ErrorStateView(message: errorMessage ?? "Unknown error") {
                        Task { await loadBooks() }
                    }
                } else if books.isEmpty {
                    LibraryEmptyStateView(
                        state: emptyState,
                        refreshAction: selectedFilter == .all ? { Task { await loadBooks() } } : nil
                    )
                } else {
                    ScrollView {
                        // Continue Reading section (only show when not searching or filtering)
                        if !recentlyReadBooks.isEmpty && searchText.isEmpty && selectedFilter == .all {
                            ContinueReadingSection(books: recentlyReadBooks) { book in
                                bookToRead = book
                            }
                            .padding(.top, 16)
                            .padding(.bottom, 8)
                        }

                        LazyVGrid(columns: columns, spacing: 16) {
                            ForEach(Array(books.enumerated()), id: \.element.id) { index, book in
                                BookGridItem(book: book)
                                    .onTapGesture {
                                        selectedBook = book
                                    }
                                    .onAppear {
                                        // Load more when nearing the end (within last 10 items)
                                        if index >= books.count - 10 && hasMore && !isLoading {
                                            Task { await loadMoreBooks() }
                                        }
                                    }
                                    .contextMenu {
                                        if let downloaded = downloadedBook(for: book.id) {
                                            Button {
                                                bookToRead = downloaded
                                            } label: {
                                                Label("Read", systemImage: "book.fill")
                                            }
                                        } else if downloadingBooks.contains(book.id) {
                                            Button(role: .destructive) {
                                                downloadManager.cancelDownload(bookId: book.id)
                                                downloadingBooks.remove(book.id)
                                            } label: {
                                                Label("Cancel Download", systemImage: "xmark.circle")
                                            }
                                        } else {
                                            Button {
                                                downloadBook(book)
                                            } label: {
                                                Label("Download", systemImage: "arrow.down.circle")
                                            }
                                        }

                                        Button {
                                            selectedBook = book
                                        } label: {
                                            Label("View Details", systemImage: "info.circle")
                                        }
                                    }
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 20)

                        if isLoading && !books.isEmpty {
                            ProgressView()
                                .padding()
                        }
                    }
                }
            }
            .navigationTitle(totalCount > 0 ? "Library (\(totalCount))" : "Library")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        ForEach(BookFilter.allCases, id: \.self) { filter in
                            Button {
                                selectedFilter = filter
                            } label: {
                                Label(filter.rawValue, systemImage: filter.icon)
                                if selectedFilter == filter {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    } label: {
                        Label("Filter", systemImage: selectedFilter == .all ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        ForEach(BookSort.allCases, id: \.self) { sort in
                            Button {
                                selectedSort = sort
                            } label: {
                                Label(sort.rawValue, systemImage: sort.icon)
                                if selectedSort == sort {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    } label: {
                        Label("Sort", systemImage: "arrow.up.arrow.down")
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Search books...")
            .onChange(of: searchText) { _, newValue in
                Task {
                    if newValue.isEmpty {
                        await loadBooks()
                    } else {
                        await searchBooks(query: newValue)
                    }
                }
            }
            .onChange(of: selectedFilter) { _, _ in
                Task {
                    await loadBooks()
                }
            }
            .onChange(of: selectedSort) { _, _ in
                Task {
                    await loadBooks()
                }
            }
            .refreshable {
                await loadBooks()
            }
            .task {
                if books.isEmpty {
                    await loadBooks()
                }
            }
            .sheet(item: $selectedBook) { book in
                BookDetailView(book: book) { downloaded in
                    bookToRead = downloaded
                }
            }
            .fullScreenCover(item: $bookToRead) { book in
                ReaderContainerView(book: book)
                    .environment(readerSettings)
            }
        }
    }

    private func loadBooks() async {
        isLoading = true
        errorMessage = nil
        offset = 0

        do {
            let response = try await apiService.fetchBooks(limit: limit, offset: 0, type: selectedFilter.apiType, orderBy: selectedSort.apiOrderBy, order: selectedSort.apiOrder)
            books = response.books
            totalCount = response.totalCount ?? response.books.count
            hasMore = response.books.count >= limit
            offset = response.books.count
        } catch {
            // Log detailed error for debugging
            print("[LibraryView] Load error: \(error)")
            if let apiError = error as? APIError {
                errorMessage = apiError.errorDescription ?? error.localizedDescription
            } else if let urlError = error as? URLError {
                errorMessage = "Connection error: \(urlError.localizedDescription) (code: \(urlError.code.rawValue))"
            } else {
                errorMessage = error.localizedDescription
            }
        }

        isLoading = false
    }

    private func loadMoreBooks() async {
        guard hasMore, !isLoading else { return }

        isLoading = true

        do {
            let response = try await apiService.fetchBooks(limit: limit, offset: offset, type: selectedFilter.apiType, orderBy: selectedSort.apiOrderBy, order: selectedSort.apiOrder)
            let newBooks = response.books
            books.append(contentsOf: newBooks)
            hasMore = newBooks.count >= limit
            offset += newBooks.count
        } catch {
            // Silently fail for pagination errors
        }

        isLoading = false
    }

    private func searchBooks(query: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await apiService.searchBooks(query: query)
            books = response.books  // Use computed property that extracts books from results
            totalCount = response.books.count  // Show search result count
            hasMore = false  // Search doesn't support pagination
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Determine the appropriate empty state based on the current filter
    private var emptyState: LibraryEmptyState {
        switch selectedFilter {
        case .all:
            return .empty
        case .ebooks:
            return .noEbooks
        case .audiobooks:
            return .noAudiobooks
        case .comics:
            return .noComics
        }
    }

    /// Check if a book is downloaded
    private func downloadedBook(for id: String) -> DownloadedBook? {
        downloadedBooks.first { $0.id == id }
    }

    /// Download a book
    private func downloadBook(_ book: Book) {
        downloadingBooks.insert(book.id)

        Task {
            do {
                _ = try await downloadManager.downloadBook(book, modelContext: modelContext)
                await MainActor.run {
                    downloadingBooks.remove(book.id)
                }
            } catch {
                await MainActor.run {
                    downloadingBooks.remove(book.id)
                }
            }
        }
    }
}

#Preview {
    LibraryView()
        .environment(ServerConfig())
        .environment(APIService(config: ServerConfig()))
        .modelContainer(for: DownloadedBook.self, inMemory: true)
}
