//
//  SeriesGridItem.swift
//  Compendus
//
//  Grid item component for displaying a series with fanned book covers
//

import SwiftUI

struct SeriesGridItem: View {
    let series: SeriesItem
    @Environment(ServerConfig.self) private var serverConfig

    /// Standard book cover aspect ratio (2:3)
    private let bookAspectRatio: CGFloat = 2/3

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Fanned covers
            ZStack {
                if series.coverBooks.isEmpty {
                    placeholderCover
                } else if series.coverBooks.count == 1 {
                    // Single book — no fan
                    singleCover(series.coverBooks[0])
                } else {
                    // Multiple books — fan out
                    ForEach(Array(series.coverBooks.prefix(3).enumerated()), id: \.element.id) { index, book in
                        coverImage(book)
                            .rotationEffect(.degrees(rotation(for: index, total: min(series.coverBooks.count, 3))))
                            .offset(x: offset(for: index, total: min(series.coverBooks.count, 3)))
                            .zIndex(Double(index))
                    }
                }
            }
            .aspectRatio(bookAspectRatio, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            // Series name and count
            VStack(alignment: .leading, spacing: 2) {
                Text(series.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(2)

                Text("\(series.bookCount) \(series.bookCount == 1 ? "book" : "books")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(series.name) series, \(series.bookCount) books")
        .accessibilityHint("Double tap to view books in this series")
    }

    // MARK: - Cover Views

    @ViewBuilder
    private func singleCover(_ book: SeriesCoverBook) -> some View {
        coverImage(book)
    }

    @ViewBuilder
    private func coverImage(_ book: SeriesCoverBook) -> some View {
        if book.coverUrl != nil, let url = serverConfig.coverURL(for: book.id) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.gray.opacity(0.2))
                        .shimmer()
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure:
                    gradientPlaceholder
                @unknown default:
                    EmptyView()
                }
            }
            .aspectRatio(bookAspectRatio, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .shadow(color: .black.opacity(0.15), radius: 2, x: 0, y: 1)
        } else {
            gradientPlaceholder
                .aspectRatio(bookAspectRatio, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .shadow(color: .black.opacity(0.15), radius: 2, x: 0, y: 1)
        }
    }

    @ViewBuilder
    private var placeholderCover: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color.gray.opacity(0.2))
            .overlay {
                Image(systemName: "books.vertical")
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
            }
    }

    @ViewBuilder
    private var gradientPlaceholder: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(
                LinearGradient(
                    colors: [.blue.opacity(0.3), .purple.opacity(0.3)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
    }

    // MARK: - Fan Layout

    private func rotation(for index: Int, total: Int) -> Double {
        switch total {
        case 1: return 0
        case 2: return index == 0 ? -4 : 4
        default: return [-6, 0, 6][index]
        }
    }

    private func offset(for index: Int, total: Int) -> CGFloat {
        switch total {
        case 1: return 0
        case 2: return index == 0 ? -6 : 6
        default: return [-8, 0, 8][index]
        }
    }
}

#Preview {
    let series = SeriesItem(
        name: "The Expanse",
        bookCount: 5,
        coverBooks: [
            SeriesCoverBook(id: "1", coverUrl: nil),
            SeriesCoverBook(id: "2", coverUrl: nil),
            SeriesCoverBook(id: "3", coverUrl: nil),
        ]
    )

    SeriesGridItem(series: series)
        .environment(ServerConfig())
        .frame(width: 180)
        .padding()
}
