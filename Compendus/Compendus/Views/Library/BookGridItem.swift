//
//  BookGridItem.swift
//  Compendus
//
//  Grid item component for displaying a book
//

import SwiftUI

struct BookGridItem: View {
    let book: Book
    @Environment(ServerConfig.self) private var serverConfig

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Cover image - only load if server has a cover
            Group {
                if book.coverUrl != nil {
                    AsyncImage(url: serverConfig.coverURL(for: book.id)) { phase in
                        switch phase {
                        case .empty:
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.gray.opacity(0.2))
                                .overlay {
                                    ProgressView()
                                }
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        case .failure:
                            placeholderCover
                        @unknown default:
                            EmptyView()
                        }
                    }
                } else {
                    placeholderCover
                }
            }
            .frame(height: 200)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .shadow(radius: 2)

            // Title and author
            VStack(alignment: .leading, spacing: 2) {
                Text(book.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(2)

                Text(book.authorsDisplay)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    formatBadge

                    if book.isAudiobook, let duration = book.durationDisplay {
                        Text(duration)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private var bookIcon: String {
        if book.isAudiobook {
            return "headphones"
        } else if book.isComic {
            return "book.pages"
        } else {
            return "book.closed"
        }
    }

    @ViewBuilder
    private var placeholderCover: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color.gray.opacity(0.2))
            .overlay {
                Image(systemName: bookIcon)
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
            }
    }

    @ViewBuilder
    private var formatBadge: some View {
        Text(book.formatDisplay)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
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
}

/// Grid item for downloaded books
struct DownloadedBookGridItem: View {
    let book: DownloadedBook

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Cover image
            if let coverData = book.coverData, let uiImage = UIImage(data: coverData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .shadow(radius: 2)
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.gray.opacity(0.2))
                    .frame(height: 200)
                    .overlay {
                        VStack {
                            Image(systemName: bookIcon)
                                .font(.largeTitle)
                                .foregroundStyle(.secondary)
                        }
                    }
            }

            // Title and author
            VStack(alignment: .leading, spacing: 2) {
                Text(book.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(2)

                Text(book.authorsDisplay)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    formatBadge

                    if book.readingProgress > 0 {
                        ProgressView(value: book.readingProgress)
                            .progressViewStyle(LinearProgressViewStyle())
                            .frame(width: 40)
                    }
                }
            }
        }
    }

    private var bookIcon: String {
        if book.isAudiobook {
            return "headphones"
        } else if book.isComic {
            return "book.pages"
        } else {
            return "book.closed"
        }
    }

    @ViewBuilder
    private var formatBadge: some View {
        Text(book.formatDisplay)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
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
}

#Preview {
    let book = Book(
        id: "1",
        title: "Sample Book Title That Is Very Long",
        subtitle: nil,
        authors: ["Author Name"],
        publisher: nil,
        publishedDate: nil,
        description: nil,
        isbn: nil,
        isbn10: nil,
        isbn13: nil,
        language: nil,
        pageCount: 300,
        format: "epub",
        series: nil,
        seriesNumber: nil,
        coverUrl: nil,
        addedAt: nil,
        fileSize: 1024000
    )

    BookGridItem(book: book)
        .environment(ServerConfig())
        .frame(width: 180)
        .padding()
}
