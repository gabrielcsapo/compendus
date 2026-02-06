//
//  DownloadedBookDetailView.swift
//  Compendus
//
//  Detail view for a downloaded book with read option
//

import SwiftUI
import SwiftData

struct DownloadedBookDetailView: View {
    let book: DownloadedBook

    @Environment(APIService.self) private var apiService
    @Environment(DownloadManager.self) private var downloadManager
    @Environment(StorageManager.self) private var storageManager
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var bookToRead: DownloadedBook?
    @State private var showingDeleteConfirmation = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Cover and basic info
                HStack(alignment: .top, spacing: 16) {
                    // Cover
                    if let coverData = book.coverData, let uiImage = UIImage(data: coverData) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 120, height: 180)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .shadow(radius: 4)
                    } else {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.gray.opacity(0.2))
                            .frame(width: 120, height: 180)
                            .overlay {
                                Image(systemName: "book.closed")
                                    .font(.largeTitle)
                                    .foregroundStyle(.secondary)
                            }
                    }

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

                // Read button
                Button {
                    bookToRead = book
                } label: {
                    Label("Read Now", systemImage: "book.fill")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .padding(.horizontal)

                // Reading progress
                if book.readingProgress > 0 {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Reading Progress")
                            .font(.headline)

                        ProgressView(value: book.readingProgress)
                            .tint(.blue)

                        Text("\(Int(book.readingProgress * 100))% complete")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if let lastRead = book.lastReadAt {
                            Text("Last read: \(lastRead.formatted(date: .abbreviated, time: .shortened))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                }

                // Description
                if let description = book.bookDescription, !description.isEmpty {
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

                // Downloaded info
                VStack(alignment: .leading, spacing: 8) {
                    Text("Download Info")
                        .font(.headline)

                    HStack {
                        Text("Downloaded")
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(book.downloadedAt.formatted(date: .abbreviated, time: .shortened))
                    }
                    .font(.subheadline)

                    if let fileURL = book.fileURL {
                        HStack {
                            Text("File")
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(fileURL.lastPathComponent)
                                .lineLimit(1)
                        }
                        .font(.subheadline)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal)

                // Delete button
                Button(role: .destructive) {
                    showingDeleteConfirmation = true
                } label: {
                    Label("Delete Download", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .foregroundStyle(.red)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
            .padding(.vertical)
        }
        .navigationTitle("Book Details")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            "Delete Book?",
            isPresented: $showingDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                deleteBook()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This will remove \"\(book.title)\" from your device. You can download it again from your library.")
        }
        .fullScreenCover(item: $bookToRead) { bookToOpen in
            ReaderContainerView(book: bookToOpen)
                .environment(apiService)
                .environment(storageManager)
                .modelContext(modelContext)
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
    private var detailsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 8) {
            if let publisher = book.publisher {
                DetailRow(label: "Publisher", value: publisher)
            }
            if let publishedDate = book.publishedDate {
                DetailRow(label: "Published", value: publishedDate)
            }
            if let series = book.series {
                let value = book.seriesNumber != nil ? "\(series) #\(Int(book.seriesNumber!))" : series
                DetailRow(label: "Series", value: value)
            }
        }
    }

    private func deleteBook() {
        do {
            try downloadManager.deleteBook(book, modelContext: modelContext)
            dismiss()
        } catch {
            // Handle error silently
        }
    }
}

#Preview {
    let book = DownloadedBook(
        id: "1",
        title: "Sample Book",
        subtitle: "A Subtitle",
        authors: ["Author Name"],
        publisher: "Publisher Name",
        publishedDate: "2024",
        bookDescription: "This is a sample book description.",
        format: "epub",
        fileSize: 1024000,
        localPath: "books/1.epub",
        series: "Sample Series",
        seriesNumber: 1
    )

    NavigationStack {
        DownloadedBookDetailView(book: book)
    }
    .environment(APIService(config: ServerConfig()))
    .environment(DownloadManager(config: ServerConfig(), apiService: APIService(config: ServerConfig())))
    .environment(StorageManager())
    .modelContainer(for: DownloadedBook.self, inMemory: true)
}
