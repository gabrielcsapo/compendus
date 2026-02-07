//
//  PDFReaderView.swift
//  Compendus
//
//  PDF reader using native PDFKit
//

import SwiftUI
import SwiftData
import PDFKit

struct PDFReaderView: View {
    let book: DownloadedBook

    @Environment(\.modelContext) private var modelContext
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var pdfDocument: PDFDocument?
    @State private var currentPage: Int = 0
    @State private var totalPages: Int = 0
    @State private var showingControls = false
    @State private var showingThumbnails = false
    @State private var errorMessage: String?
    @State private var brightness: Double = Double(UIScreen.main.brightness)
    @State private var originalBrightness: Double = Double(UIScreen.main.brightness)

    var body: some View {
        Group {
            if let error = errorMessage {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                }
            } else if let document = pdfDocument {
                ZStack {
                    PDFKitView(document: document, currentPage: $currentPage)
                        .ignoresSafeArea(edges: .bottom)

                    // Controls overlay
                    VStack(spacing: 0) {
                        Spacer()

                        // Thumbnail scrubber
                        if showingThumbnails {
                            PDFThumbnailScrubber(
                                document: document,
                                currentPage: $currentPage
                            )
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                        }

                        // Main controls
                        if showingControls {
                            controlsOverlay
                                .transition(.move(edge: .bottom).combined(with: .opacity))
                        }

                        // Page indicator (always visible when controls shown)
                        if showingControls || !showingThumbnails {
                            pageIndicator
                        }
                    }
                }
                .onTapGesture {
                    withAnimation(reduceMotion ? .none : .spring(response: 0.35, dampingFraction: 0.8)) {
                        showingControls.toggle()
                        if !showingControls {
                            showingThumbnails = false
                        }
                    }
                }
            } else {
                ProgressView("Loading PDF...")
            }
        }
        .navigationTitle(book.title)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            loadPDF()
        }
        .onChange(of: currentPage) { _, newValue in
            saveProgress(page: newValue)
        }
        .onDisappear {
            // Restore original brightness when leaving
            UIScreen.main.brightness = CGFloat(originalBrightness)
        }
    }

    @ViewBuilder
    private var controlsOverlay: some View {
        VStack(spacing: 16) {
            // Brightness control
            HStack(spacing: 12) {
                Image(systemName: "sun.min")
                    .foregroundStyle(.secondary)

                Slider(value: $brightness, in: 0...1)
                    .onChange(of: brightness) { _, newValue in
                        UIScreen.main.brightness = CGFloat(newValue)
                    }

                Image(systemName: "sun.max")
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal)

            // Page slider
            if totalPages > 1 {
                VStack(spacing: 4) {
                    Slider(
                        value: Binding(
                            get: { Double(currentPage) },
                            set: { currentPage = Int($0) }
                        ),
                        in: 0...Double(max(0, totalPages - 1)),
                        step: 1
                    )

                    HStack {
                        Text("1")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text("\(totalPages)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal)
            }

            // Thumbnail toggle button
            Button {
                withAnimation(reduceMotion ? .none : .spring(response: 0.35, dampingFraction: 0.8)) {
                    showingThumbnails.toggle()
                }
            } label: {
                Label(
                    showingThumbnails ? "Hide Thumbnails" : "Show Thumbnails",
                    systemImage: showingThumbnails ? "rectangle.grid.1x2.fill" : "rectangle.grid.1x2"
                )
                .font(.subheadline)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private var pageIndicator: some View {
        Text("\(currentPage + 1) / \(totalPages)")
            .font(.subheadline.monospacedDigit())
            .fontWeight(.medium)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .clipShape(Capsule())
            .padding(.bottom, 16)
    }

    private func loadPDF() {
        guard let fileURL = book.fileURL else {
            errorMessage = "Could not find the PDF file"
            return
        }

        guard let document = PDFDocument(url: fileURL) else {
            errorMessage = "Could not open the PDF file"
            return
        }

        pdfDocument = document
        totalPages = document.pageCount

        // Restore last position
        if let lastPosition = book.lastPosition, let page = Int(lastPosition) {
            currentPage = min(page, totalPages - 1)
        }
    }

    private func saveProgress(page: Int) {
        book.lastPosition = String(page)
        book.readingProgress = totalPages > 0 ? Double(page + 1) / Double(totalPages) : 0
        try? modelContext.save()
    }
}

struct PDFKitView: UIViewRepresentable {
    let document: PDFDocument
    @Binding var currentPage: Int

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.document = document
        pdfView.autoScales = true
        pdfView.displayMode = .singlePage
        pdfView.displayDirection = .horizontal
        pdfView.usePageViewController(true)

        // Set initial page
        if let page = document.page(at: currentPage) {
            pdfView.go(to: page)
        }

        // Add notification observer for page changes
        NotificationCenter.default.addObserver(
            context.coordinator,
            selector: #selector(Coordinator.pageChanged(_:)),
            name: .PDFViewPageChanged,
            object: pdfView
        )

        return pdfView
    }

    func updateUIView(_ pdfView: PDFView, context: Context) {
        // Only go to page if it's different from current
        if let currentDisplayedPage = pdfView.currentPage {
            let currentIndex = document.index(for: currentDisplayedPage)
            if currentIndex != NSNotFound && currentIndex != currentPage {
                if let page = document.page(at: currentPage) {
                    pdfView.go(to: page)
                }
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject {
        var parent: PDFKitView

        init(_ parent: PDFKitView) {
            self.parent = parent
        }

        @objc func pageChanged(_ notification: Notification) {
            guard let pdfView = notification.object as? PDFView,
                  let currentPage = pdfView.currentPage,
                  let document = pdfView.document else { return }

            let pageIndex = document.index(for: currentPage)
            guard pageIndex != NSNotFound else { return }

            DispatchQueue.main.async {
                if self.parent.currentPage != pageIndex {
                    self.parent.currentPage = pageIndex
                }
            }
        }
    }
}

#Preview {
    let book = DownloadedBook(
        id: "1",
        title: "Sample PDF",
        authors: ["Author"],
        format: "pdf",
        fileSize: 1024000,
        localPath: "books/1.pdf"
    )

    NavigationStack {
        PDFReaderView(book: book)
    }
    .modelContainer(for: DownloadedBook.self, inMemory: true)
}
