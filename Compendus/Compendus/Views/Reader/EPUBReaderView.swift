//
//  EPUBReaderView.swift
//  Compendus
//
//  EPUB reader using Readium Swift toolkit
//
//  Required packages:
//  - ReadiumShared
//  - ReadiumStreamer
//  - ReadiumNavigator
//  - ReadiumAdapterGCDWebServer (for HTTP server)
//

import SwiftUI
import SwiftData
import ReadiumShared
import ReadiumStreamer
import ReadiumNavigator
import ReadiumAdapterGCDWebServer

// MARK: - Readium Services

@MainActor
final class ReadiumServices {
    static let shared = ReadiumServices()

    lazy var httpClient: HTTPClient = DefaultHTTPClient()
    lazy var httpServer: HTTPServer = GCDHTTPServer(assetRetriever: assetRetriever)

    lazy var assetRetriever = AssetRetriever(httpClient: httpClient)

    lazy var publicationOpener = PublicationOpener(
        parser: DefaultPublicationParser(
            httpClient: httpClient,
            assetRetriever: assetRetriever,
            pdfFactory: DefaultPDFDocumentFactory()
        ),
        contentProtections: []
    )
}

// MARK: - EPUB Reader View

struct EPUBReaderView: View {
    let book: DownloadedBook

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var readerState: ReaderState = .loading
    @State private var publication: Publication?
    @State private var navigator: EPUBNavigatorViewController?
    @State private var currentLocator: Locator?
    @State private var showingTOC = false
    @State private var readerDelegate: EPUBReaderDelegate?

    enum ReaderState {
        case loading
        case ready
        case error(String)
    }

    var body: some View {
        Group {
            switch readerState {
            case .loading:
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.5)
                    Text("Loading EPUB...")
                        .foregroundStyle(.secondary)
                }
            case .ready:
                if let navigator = navigator {
                    VStack(spacing: 0) {
                        EPUBNavigatorWrapper(navigator: navigator)

                        // Progress bar at bottom
                        VStack(spacing: 4) {
                            ProgressView(value: currentLocator?.locations.totalProgression ?? 0)
                                .tint(.blue)

                            HStack {
                                if let title = currentLocator?.title, !title.isEmpty {
                                    Text(title)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Text("\(Int((currentLocator?.locations.totalProgression ?? 0) * 100))%")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                        .background(Color(.systemBackground))
                    }
                }
            case .error(let message):
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                }
            }
        }
        .navigationTitle(book.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if case .ready = readerState {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingTOC = true
                    } label: {
                        Image(systemName: "list.bullet")
                    }
                }
            }
        }
        .task {
            await loadEPUB()
        }
        .onDisappear {
            saveProgress()
        }
        .sheet(isPresented: $showingTOC) {
            if let publication = publication, let navigator = navigator {
                EPUBTOCView(
                    publication: publication,
                    currentLocator: currentLocator,
                    onSelect: { locator in
                        Task {
                            _ = await navigator.go(to: locator)
                        }
                        showingTOC = false
                    }
                )
            }
        }
    }

    private func loadEPUB() async {
        guard let fileURL = book.fileURL else {
            readerState = .error("Could not find the EPUB file")
            return
        }

        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            readerState = .error("EPUB file not found at expected location")
            return
        }

        do {
            let services = ReadiumServices.shared

            // Create an absolute URL
            guard let absoluteURL = FileURL(url: fileURL) else {
                readerState = .error("Invalid file URL")
                return
            }

            // Retrieve the asset
            let assetResult = await services.assetRetriever.retrieve(url: absoluteURL)
            guard case .success(let asset) = assetResult else {
                if case .failure(let error) = assetResult {
                    readerState = .error("Failed to retrieve asset: \(error)")
                }
                return
            }

            // Open the publication
            let pubResult = await services.publicationOpener.open(
                asset: asset,
                allowUserInteraction: false,
                sender: nil
            )

            guard case .success(let pub) = pubResult else {
                if case .failure(let error) = pubResult {
                    readerState = .error("Failed to open EPUB: \(error)")
                }
                return
            }

            self.publication = pub

            // Restore last position if available
            var initialLocator: Locator? = nil
            if let lastPosition = book.lastPosition,
               let locatorData = lastPosition.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: locatorData) as? [String: Any],
               let totalProgression = (json["locations"] as? [String: Any])?["totalProgression"] as? Double {
                // Use totalProgression to locate position
                initialLocator = await pub.locate(progression: totalProgression)
            }

            // Create the navigator
            let nav = try EPUBNavigatorViewController(
                publication: pub,
                initialLocation: initialLocator,
                config: .init(),
                httpServer: services.httpServer
            )

            // Set up delegate
            let delegate = EPUBReaderDelegate()
            delegate.onLocationChanged = { locator in
                Task { @MainActor in
                    self.currentLocator = locator
                }
            }
            nav.delegate = delegate
            self.readerDelegate = delegate

            self.navigator = nav
            self.readerState = .ready

        } catch {
            readerState = .error("Failed to open EPUB: \(error.localizedDescription)")
        }
    }

    private func saveProgress() {
        guard let locator = currentLocator else { return }

        // Save a simplified version of the locator
        let locatorDict: [String: Any] = [
            "href": locator.href.url.absoluteString,
            "type": locator.mediaType.string,
            "title": locator.title ?? "",
            "locations": [
                "progression": locator.locations.progression ?? 0,
                "totalProgression": locator.locations.totalProgression ?? 0
            ]
        ]

        if let data = try? JSONSerialization.data(withJSONObject: locatorDict),
           let string = String(data: data, encoding: .utf8) {
            book.lastPosition = string
        }

        if let progression = locator.locations.totalProgression {
            book.readingProgress = progression
        }

        try? modelContext.save()
    }
}

// MARK: - EPUB Reader Delegate

class EPUBReaderDelegate: NSObject, EPUBNavigatorDelegate {
    var onLocationChanged: ((Locator) -> Void)?

    func navigator(_ navigator: any Navigator, didFailToLoadResourceAt href: RelativeURL, withError error: ReadError) {
        print("Failed to load resource at \(href): \(error)")
    }

    func navigator(_ navigator: any Navigator, locationDidChange locator: Locator) {
        onLocationChanged?(locator)
    }

    func navigator(_ navigator: any Navigator, presentError error: NavigatorError) {
        print("Navigator error: \(error)")
    }
}

// MARK: - Navigator Wrapper

struct EPUBNavigatorWrapper: UIViewControllerRepresentable {
    let navigator: EPUBNavigatorViewController

    func makeUIViewController(context: Context) -> EPUBNavigatorViewController {
        return navigator
    }

    func updateUIViewController(_ uiViewController: EPUBNavigatorViewController, context: Context) {
        // Updates handled via delegate
    }
}

// MARK: - Table of Contents

struct EPUBTOCView: View {
    let publication: Publication
    let currentLocator: Locator?
    let onSelect: (Locator) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var tocItems: [ReadiumShared.Link] = []
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading...")
                } else if tocItems.isEmpty {
                    ContentUnavailableView {
                        Label("No Table of Contents", systemImage: "list.bullet")
                    } description: {
                        Text("This EPUB doesn't have a table of contents.")
                    }
                } else {
                    List(tocItems, id: \.href) { link in
                        Button {
                            Task {
                                if let locator = await publication.locate(link) {
                                    onSelect(locator)
                                }
                            }
                        } label: {
                            HStack {
                                Text(link.title ?? "Untitled")
                                    .foregroundStyle(.primary)
                                Spacer()
                                if isCurrentChapter(link) {
                                    Image(systemName: "bookmark.fill")
                                        .foregroundStyle(.blue)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Table of Contents")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                await loadTOC()
            }
        }
    }

    private func loadTOC() async {
        let result = await publication.tableOfContents()
        if case .success(let items) = result {
            tocItems = items
        }
        isLoading = false
    }

    private func isCurrentChapter(_ link: ReadiumShared.Link) -> Bool {
        guard let current = currentLocator else { return false }
        return link.href == current.href.url.absoluteString
    }
}

#Preview {
    let book = DownloadedBook(
        id: "1",
        title: "Sample EPUB",
        authors: ["Author Name"],
        format: "epub",
        fileSize: 1024000,
        localPath: "books/1.epub"
    )

    NavigationStack {
        EPUBReaderView(book: book)
    }
    .modelContainer(for: DownloadedBook.self, inMemory: true)
}
