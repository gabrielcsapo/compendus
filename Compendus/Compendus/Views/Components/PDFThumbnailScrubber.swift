//
//  PDFThumbnailScrubber.swift
//  Compendus
//
//  Horizontal scroll of PDF page thumbnails for quick navigation
//

import SwiftUI
import PDFKit

/// A horizontal thumbnail scrubber for PDF navigation
struct PDFThumbnailScrubber: View {
    let document: PDFDocument
    @Binding var currentPage: Int
    var onPageSelected: ((Int) -> Void)?

    private let thumbnailSize = CGSize(width: 60, height: 80)

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 8) {
                    ForEach(0..<document.pageCount, id: \.self) { index in
                        PDFThumbnailView(
                            document: document,
                            pageIndex: index,
                            size: thumbnailSize,
                            isSelected: index == currentPage
                        )
                        .id(index)
                        .onTapGesture {
                            currentPage = index
                            onPageSelected?(index)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            .onChange(of: currentPage) { _, newValue in
                withAnimation {
                    proxy.scrollTo(newValue, anchor: .center)
                }
            }
            .onAppear {
                // Scroll to current page on appear
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    proxy.scrollTo(currentPage, anchor: .center)
                }
            }
        }
        .frame(height: thumbnailSize.height + 24)
        .background(.ultraThinMaterial)
    }
}

/// Individual PDF page thumbnail
struct PDFThumbnailView: View {
    let document: PDFDocument
    let pageIndex: Int
    let size: CGSize
    let isSelected: Bool

    @State private var thumbnail: UIImage?

    var body: some View {
        Group {
            if let thumbnail = thumbnail {
                Image(uiImage: thumbnail)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .overlay {
                        Text("\(pageIndex + 1)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
            }
        }
        .frame(width: size.width, height: size.height)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(
            RoundedRectangle(cornerRadius: 4)
                .stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 2)
        )
        .shadow(color: isSelected ? .accentColor.opacity(0.3) : .clear, radius: 4)
        .scaleEffect(isSelected ? 1.05 : 1.0)
        .animation(.spring(response: 0.3), value: isSelected)
        .task {
            await loadThumbnail()
        }
        .accessibilityLabel("Page \(pageIndex + 1)")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    private func loadThumbnail() async {
        guard thumbnail == nil,
              let page = document.page(at: pageIndex) else { return }

        let image = await Task.detached(priority: .userInitiated) {
            page.thumbnail(of: size, for: .mediaBox)
        }.value

        await MainActor.run {
            self.thumbnail = image
        }
    }
}

#Preview {
    // This preview won't work without a real PDF document
    VStack {
        Text("PDF Thumbnail Scrubber Preview")
            .padding()
        Spacer()
    }
}
