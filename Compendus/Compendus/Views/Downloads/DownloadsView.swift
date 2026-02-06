//
//  DownloadsView.swift
//  Compendus
//
//  View for managing downloaded books
//

import SwiftUI
import SwiftData

enum DownloadFilter: String, CaseIterable {
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

    func matches(format: String) -> Bool {
        let fmt = format.lowercased()
        switch self {
        case .all: return true
        case .ebooks: return ["epub", "pdf", "mobi", "azw", "azw3"].contains(fmt)
        case .audiobooks: return ["m4b", "mp3", "m4a"].contains(fmt)
        case .comics: return ["cbr", "cbz"].contains(fmt)
        }
    }
}

struct DownloadsView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(APIService.self) private var apiService
    @Environment(DownloadManager.self) private var downloadManager
    @Environment(StorageManager.self) private var storageManager

    @Query(sort: \DownloadedBook.downloadedAt, order: .reverse)
    private var books: [DownloadedBook]

    @State private var bookToDelete: DownloadedBook?
    @State private var showingDeleteConfirmation = false
    @State private var searchText = ""
    @State private var selectedFilter: DownloadFilter = .all
    @State private var showingStorageBreakdown = false

    private let columns = [
        GridItem(.adaptive(minimum: 150, maximum: 200), spacing: 16)
    ]

    private var filteredBooks: [DownloadedBook] {
        var result = books

        // Apply type filter
        if selectedFilter != .all {
            result = result.filter { selectedFilter.matches(format: $0.format) }
        }

        // Apply search filter
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            result = result.filter { book in
                book.title.lowercased().contains(query) ||
                book.authors.joined(separator: " ").lowercased().contains(query)
            }
        }

        return result
    }

    var body: some View {
        NavigationStack {
            Group {
                if books.isEmpty {
                    ContentUnavailableView {
                        Label("No Downloads", systemImage: "arrow.down.circle")
                    } description: {
                        Text("Downloaded books will appear here for offline reading")
                    }
                } else if filteredBooks.isEmpty {
                    if !searchText.isEmpty {
                        ContentUnavailableView.search(text: searchText)
                    } else {
                        ContentUnavailableView {
                            Label("No \(selectedFilter.rawValue)", systemImage: selectedFilter.icon)
                        } description: {
                            Text("No \(selectedFilter.rawValue.lowercased()) found in your downloads")
                        }
                    }
                } else {
                    ScrollView {
                        // Storage summary (only show when not searching or filtering)
                        if searchText.isEmpty && selectedFilter == .all {
                            StorageUsageView {
                                showingStorageBreakdown = true
                            }
                            .padding(.horizontal)
                            .padding(.top)
                        }

                        LazyVGrid(columns: columns, spacing: 16) {
                            ForEach(filteredBooks) { book in
                                NavigationLink(value: book) {
                                    DownloadedBookGridItem(book: book)
                                }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button(role: .destructive) {
                                        bookToDelete = book
                                        showingDeleteConfirmation = true
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Downloads")
            .toolbar {
                if !books.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            ForEach(DownloadFilter.allCases, id: \.self) { filter in
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
                            Button(role: .destructive) {
                                bookToDelete = nil  // nil means delete all
                                showingDeleteConfirmation = true
                            } label: {
                                Label("Delete All", systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                    }
                }
            }
            .navigationDestination(for: DownloadedBook.self) { book in
                DownloadedBookDetailView(book: book)
            }
            .searchable(text: $searchText, prompt: "Search downloads...")
            .confirmationDialog(
                deleteDialogTitle,
                isPresented: $showingDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    performDelete()
                }
                Button("Cancel", role: .cancel) {
                    bookToDelete = nil
                }
            } message: {
                Text(deleteDialogMessage)
            }
            .sheet(isPresented: $showingStorageBreakdown) {
                StorageBreakdownView()
            }
        }
    }

    private var deleteDialogTitle: String {
        if bookToDelete != nil {
            return "Delete Book?"
        } else {
            return "Delete All Books?"
        }
    }

    private var deleteDialogMessage: String {
        if let book = bookToDelete {
            return "This will remove \"\(book.title)\" from your device. You can download it again from your library."
        } else {
            return "This will remove all downloaded books from your device. You can download them again from your library."
        }
    }

    private func performDelete() {
        do {
            if let book = bookToDelete {
                try downloadManager.deleteBook(book, modelContext: modelContext)
            } else {
                try downloadManager.deleteAllBooks(modelContext: modelContext)
            }
        } catch {
            // Handle error silently for now
        }
        bookToDelete = nil
    }
}

#Preview {
    let config = ServerConfig()
    let api = APIService(config: config)

    DownloadsView()
        .environment(api)
        .environment(DownloadManager(config: config, apiService: api))
        .environment(StorageManager())
        .modelContainer(for: DownloadedBook.self, inMemory: true)
}
