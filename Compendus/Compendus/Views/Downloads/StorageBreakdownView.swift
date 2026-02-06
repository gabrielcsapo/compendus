//
//  StorageBreakdownView.swift
//  Compendus
//
//  Shows downloaded books sorted by file size
//

import SwiftUI
import SwiftData

struct StorageBreakdownView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(DownloadManager.self) private var downloadManager
    @Environment(StorageManager.self) private var storageManager

    @Query(sort: \DownloadedBook.fileSize, order: .reverse)
    private var books: [DownloadedBook]

    @State private var bookToDelete: DownloadedBook?
    @State private var showingDeleteConfirmation = false

    var body: some View {
        NavigationStack {
            List {
                // Summary section
                Section {
                    HStack {
                        Text("Total Used")
                        Spacer()
                        Text(storageManager.totalStorageUsedDisplay())
                            .fontWeight(.semibold)
                    }
                    HStack {
                        Text("Available")
                        Spacer()
                        Text(storageManager.availableDiskSpaceDisplay())
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        Text("Books")
                        Spacer()
                        Text("\(books.count)")
                            .foregroundStyle(.secondary)
                    }
                }

                // Books sorted by size
                Section("Books by Size") {
                    if books.isEmpty {
                        Text("No downloaded books")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(books) { book in
                            StorageBookRow(book: book)
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        bookToDelete = book
                                        showingDeleteConfirmation = true
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                        }
                    }
                }
            }
            .navigationTitle("Storage")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .confirmationDialog(
                "Delete Book?",
                isPresented: $showingDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    if let book = bookToDelete {
                        try? downloadManager.deleteBook(book, modelContext: modelContext)
                    }
                    bookToDelete = nil
                }
                Button("Cancel", role: .cancel) {
                    bookToDelete = nil
                }
            } message: {
                if let book = bookToDelete {
                    Text("This will remove \"\(book.title)\" and free up \(book.fileSizeDisplay).")
                }
            }
        }
    }
}

struct StorageBookRow: View {
    let book: DownloadedBook

    var body: some View {
        HStack(spacing: 12) {
            // Format icon
            Image(systemName: formatIcon)
                .font(.title2)
                .foregroundStyle(formatColor)
                .frame(width: 32)

            // Book info
            VStack(alignment: .leading, spacing: 2) {
                Text(book.title)
                    .font(.subheadline)
                    .lineLimit(1)

                Text(book.authors.isEmpty ? "Unknown Author" : book.authors.joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // File size
            Text(book.fileSizeDisplay)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }

    private var formatIcon: String {
        let fmt = book.format.lowercased()
        if ["m4b", "mp3", "m4a"].contains(fmt) {
            return "headphones"
        } else if ["cbr", "cbz"].contains(fmt) {
            return "book.pages"
        } else {
            return "book.closed"
        }
    }

    private var formatColor: Color {
        let fmt = book.format.lowercased()
        if ["m4b", "mp3", "m4a"].contains(fmt) {
            return .green
        } else if ["cbr", "cbz"].contains(fmt) {
            return .purple
        } else if fmt == "pdf" {
            return .red
        } else if fmt == "epub" {
            return .blue
        } else {
            return .orange
        }
    }
}

#Preview {
    let config = ServerConfig()
    let api = APIService(config: config)

    StorageBreakdownView()
        .environment(DownloadManager(config: config, apiService: api))
        .environment(StorageManager())
        .modelContainer(for: DownloadedBook.self, inMemory: true)
}
