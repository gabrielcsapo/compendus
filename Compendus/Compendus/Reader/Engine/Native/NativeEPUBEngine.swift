//
//  NativeEPUBEngine.swift
//  Compendus
//
//  ReaderEngine implementation for EPUB files using native UITextView rendering.
//  Replaces the WKWebView-based EPUBEngine with Core Text pagination
//  and NSAttributedString-based content display.
//

import UIKit
import SwiftSoup
import os.log

private let logger = Logger(subsystem: "com.compendus.reader", category: "NativeEPUB")

@Observable
@MainActor
class NativeEPUBEngine: ReaderEngine {
    var currentLocation: ReaderLocation?
    var totalPositions: Int = 0
    var isReady: Bool = false
    var errorMessage: String?

    var onSelectionChanged: ((ReaderSelection?) -> Void)?
    var onHighlightTapped: ((String) -> Void)?
    var onTapZone: ((String) -> Void)?

    private var parser: EPUBParser?
    private var pageViewController: NativePageViewController?
    private let bookURL: URL

    // Spine/page tracking (same pattern as EPUBEngine)
    private var currentSpineIndex: Int = 0
    private var currentPageIndex: Int = 0
    private var spinePageCounts: [Int] = []
    private var pendingHighlights: [BookHighlight] = []

    // Store a snapshot of settings values (not a reference) so we can detect changes
    private struct SettingsSnapshot {
        let theme: ReaderTheme
        let fontFamily: ReaderFont
        let fontSize: Double
        let lineHeight: Double
    }
    private var settingsSnapshot: SettingsSnapshot?
    private var currentSettings: ReaderSettings?

    // Content cache
    private var parsedChapters: [Int: [ContentNode]] = [:]
    private var chapterStrings: [Int: NSAttributedString] = [:]
    private var chapterPages: [Int: [PageInfo]] = [:]
    private var chapterOffsetMaps: [Int: OffsetMap] = [:]

    // CSS stylesheet loaded once per book
    private var bookStylesheet: CSSStylesheet?

    // Media attachments for current chapter (for video/audio tap handling)
    private var currentMediaAttachments: [MediaAttachment] = []

    // Floating elements for current chapter (CSS float images)
    private var currentFloatingElements: [FloatingElement] = []

    // Viewport
    private var viewportSize: CGSize = .zero

    // Deferred initial load (waits for view to have proper size)
    private var pendingInitialLoad: (spineIndex: Int, progression: Double?)?

    init(bookURL: URL) {
        self.bookURL = bookURL
    }

    // MARK: - Loading

    func load(initialPosition: String? = nil) async {
        logger.info("Loading EPUB from \(self.bookURL.lastPathComponent)")
        do {
            let parser = try await EPUBParser.parse(epubURL: bookURL)
            self.parser = parser
            logger.info("Parsed EPUB: \(parser.package.spine.count) spine items, \(parser.package.manifest.count) manifest items")

            // Load CSS stylesheets once for the entire book
            loadStylesheets(from: parser)

            // Initialize spine page counts
            spinePageCounts = Array(repeating: 1, count: parser.package.spine.count)

            // Create page view controller
            let pageVC = NativePageViewController()
            setupCallbacks(pageVC)
            self.pageViewController = pageVC

            // Determine initial position
            var initialSpineIndex = 0
            var initialProgression: Double?

            if let positionJSON = initialPosition,
               let data = positionJSON.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let href = json["href"] as? String {
                    for (index, spineItem) in parser.package.spine.enumerated() {
                        if let manifest = parser.package.manifest[spineItem.idref],
                           manifest.href == href || href.contains(manifest.href) {
                            initialSpineIndex = index
                            break
                        }
                    }
                }
                if let locations = json["locations"] as? [String: Any] {
                    initialProgression = locations["progression"] as? Double
                } else {
                    initialProgression = json["progression"] as? Double
                }
            }

            currentSpineIndex = initialSpineIndex

            // Store the pending load — will fire when the view has a proper size
            pendingInitialLoad = (spineIndex: initialSpineIndex, progression: initialProgression)

            // The view controller notifies us via onViewReady when it's in the
            // hierarchy and has a non-zero size (viewDidAppear/viewDidLayoutSubviews)
            pageVC.onViewReady = { [weak self] size in
                guard let self = self else { return }
                logger.info("View ready with size \(size.width)x\(size.height)")
                self.viewportSize = size
                if let pending = self.pendingInitialLoad {
                    self.pendingInitialLoad = nil
                    logger.info("Executing deferred load: spine \(pending.spineIndex), progression \(pending.progression ?? -1)")
                    self.loadChapter(at: pending.spineIndex, progression: pending.progression)
                }
            }

        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func setupCallbacks(_ pageVC: NativePageViewController) {
        pageVC.onPageChanged = { [weak self] page, totalPages in
            guard let self = self else { return }
            self.currentPageIndex = page
            self.updateSpinePageCount(totalPages)
            self.updateLocation()
        }

        pageVC.onSelectionChanged = { [weak self] selection in
            self?.onSelectionChanged?(selection)
        }

        pageVC.onHighlightTapped = { [weak self] id in
            self?.onHighlightTapped?(id)
        }

        pageVC.onTapZone = { [weak self] zone in
            self?.onTapZone?(zone)
        }

        pageVC.onLinkTapped = { [weak self] url in
            self?.handleLinkTap(url)
        }
    }

    private func handleLinkTap(_ url: URL) {
        guard let parser = parser else { return }

        // Get the href relative to the EPUB root
        let href = url.lastPathComponent
        let hrefBase = href.components(separatedBy: "#").first ?? href

        // Check if it's an internal link to a spine item
        for (index, spineItem) in parser.package.spine.enumerated() {
            guard let manifest = parser.package.manifest[spineItem.idref] else { continue }
            let manifestBase = manifest.href.components(separatedBy: "#").first ?? manifest.href

            if manifest.href == href || manifestBase == hrefBase
                || href.hasSuffix(manifestBase) || manifestBase.hasSuffix(hrefBase)
                || manifest.href.hasSuffix(hrefBase) || hrefBase.hasSuffix(manifest.href.components(separatedBy: "/").last ?? "") {

                if index != currentSpineIndex {
                    loadChapter(at: index)
                } else {
                    // Same chapter — scroll to top
                    pageViewController?.showPage(0)
                    currentPageIndex = 0
                    updateLocation()
                }
                return
            }
        }

        // External link — open in system browser
        if url.scheme == "http" || url.scheme == "https" {
            UIApplication.shared.open(url)
        }
    }

    // Media players are managed inline by NativePageViewController.
    // No overlay-based presentation needed.

    // MARK: - CSS Stylesheet Loading

    private func loadStylesheets(from parser: EPUBParser) {
        var combined = CSSStylesheet()
        for (_, item) in parser.package.manifest {
            guard item.mediaType == "text/css" else { continue }
            let cssURL = parser.resolveURL(for: item)
            guard let cssData = try? Data(contentsOf: cssURL),
                  let cssText = String(data: cssData, encoding: .utf8) else { continue }
            let parsed = CSSParser.parse(cssText)
            combined.merge(with: parsed)
        }
        self.bookStylesheet = combined
        logger.info("Loaded CSS stylesheets from manifest")
    }

    // MARK: - Chapter Loading

    private func loadChapter(at spineIndex: Int, startAtEnd: Bool = false, progression: Double? = nil) {
        guard let parser = parser else { return }
        guard spineIndex >= 0, spineIndex < parser.package.spine.count else { return }

        currentSpineIndex = spineIndex

        // Update viewport size from current view
        if let vcView = pageViewController?.view, vcView.bounds.width > 0 {
            viewportSize = vcView.bounds.size
        }

        // Get chapter file URL
        guard let chapterURL = parser.resolveSpineItemURL(at: spineIndex) else {
            errorMessage = "Could not resolve chapter at index \(spineIndex)"
            return
        }

        logger.info("Loading chapter \(spineIndex) from \(chapterURL.lastPathComponent)")

        // Parse XHTML if not cached
        if parsedChapters[spineIndex] == nil {
            guard let data = try? Data(contentsOf: chapterURL) else {
                logger.error("Failed to read chapter file at \(chapterURL.path)")
                errorMessage = "Could not read chapter file"
                return
            }
            logger.info("Chapter XHTML data: \(data.count) bytes")
            let baseURL = chapterURL.deletingLastPathComponent()
            let contentParser = XHTMLContentParser(data: data, baseURL: baseURL, stylesheet: bookStylesheet)
            parsedChapters[spineIndex] = contentParser.parse()
        }

        guard let nodes = parsedChapters[spineIndex] else { return }
        logger.info("Parsed \(nodes.count) content nodes")

        // Build attributed string if not cached (or settings changed)
        let settings = currentSettings ?? ReaderSettings()
        let insets = NativePaginationEngine.insets(for: viewportSize.width)
        let contentWidth = viewportSize.width - insets.left - insets.right
        let contentHeight = viewportSize.height - insets.top - insets.bottom
        logger.info("Viewport: \(self.viewportSize.width)x\(self.viewportSize.height), contentWidth: \(contentWidth)")
        let builder = AttributedStringBuilder(settings: settings, contentWidth: max(1, contentWidth), contentHeight: max(1, contentHeight))
        let (attrString, offsetMap) = builder.build(from: nodes)
        chapterStrings[spineIndex] = attrString
        chapterOffsetMaps[spineIndex] = offsetMap
        logger.info("Attributed string: \(attrString.length) chars, offsets: \(offsetMap.entries.count)")

        if attrString.length > 0 {
            let preview = attrString.string.prefix(100)
            logger.info("Content preview: \(preview)")
        } else {
            logger.warning("Attributed string is EMPTY — content will not be visible")
        }

        // Store media attachments and floating elements
        currentMediaAttachments = builder.mediaAttachments
        currentFloatingElements = builder.floatingElements

        // Paginate
        let pages = NativePaginationEngine.paginate(
            attributedString: attrString,
            viewportSize: viewportSize,
            contentInsets: insets
        )
        chapterPages[spineIndex] = pages
        updateSpinePageCount(pages.count)
        logger.info("Paginated into \(pages.count) pages")

        // Determine starting page
        var startPage = 0
        if startAtEnd {
            startPage = max(0, pages.count - 1)
        } else if let progression = progression, progression > 0 {
            startPage = Int(round(progression * Double(max(1, pages.count - 1))))
            startPage = max(0, min(startPage, pages.count - 1))
        }

        currentPageIndex = startPage

        // Display
        let manifestItem = parser.manifestItem(forSpineIndex: spineIndex)
        pageViewController?.loadContent(
            attributedString: attrString,
            pages: pages,
            chapterHref: manifestItem?.href,
            startAtPage: startPage,
            mediaAttachments: currentMediaAttachments,
            floatingElements: currentFloatingElements
        )

        // Apply theme
        if let settings = currentSettings {
            pageViewController?.applyTheme(backgroundColor: settings.theme.backgroundColor)
        }

        // Apply highlights
        applyHighlightsToCurrentPage()

        isReady = true
        updateLocation()

        // Pre-fetch adjacent chapters in background
        prefetchAdjacentChapters()
    }

    private func updateSpinePageCount(_ pageCount: Int) {
        if currentSpineIndex < spinePageCounts.count {
            spinePageCounts[currentSpineIndex] = pageCount
        }
        totalPositions = spinePageCounts.reduce(0, +)
    }

    private func prefetchAdjacentChapters() {
        guard let parser = parser else { return }
        let indices = [currentSpineIndex - 1, currentSpineIndex + 1]
        let stylesheet = bookStylesheet
        for index in indices {
            guard index >= 0, index < parser.package.spine.count,
                  parsedChapters[index] == nil else { continue }

            Task.detached { [weak self] in
                guard let self = self else { return }
                guard let chapterURL = await parser.resolveSpineItemURL(at: index),
                      let data = try? Data(contentsOf: chapterURL) else { return }

                let baseURL = chapterURL.deletingLastPathComponent()
                let contentParser = XHTMLContentParser(data: data, baseURL: baseURL, stylesheet: stylesheet)
                let nodes = contentParser.parse()

                await MainActor.run {
                    self.parsedChapters[index] = nodes
                }
            }
        }
    }

    // MARK: - Location Tracking

    private func updateLocation() {
        guard let parser = parser else { return }

        let manifestItem = parser.manifestItem(forSpineIndex: currentSpineIndex)
        let chapterPageCount = chapterPages[currentSpineIndex]?.count ?? 1
        let chapterProgression = chapterPageCount > 1
            ? Double(currentPageIndex) / Double(chapterPageCount - 1)
            : 0

        let pagesBeforeCurrent = (0..<currentSpineIndex).reduce(0) { sum, i in
            sum + (i < spinePageCounts.count ? spinePageCounts[i] : 1)
        }
        let totalPagesCount = max(1, spinePageCounts.reduce(0, +))
        let totalProgression = Double(pagesBeforeCurrent + currentPageIndex) / Double(totalPagesCount)

        let chapterTitle = findChapterTitle(for: manifestItem?.href)

        currentLocation = ReaderLocation(
            href: manifestItem?.href,
            pageIndex: currentPageIndex,
            progression: chapterProgression,
            totalProgression: min(1.0, totalProgression),
            title: chapterTitle
        )
    }

    private func findChapterTitle(for href: String?) -> String? {
        guard let href = href, let parser = parser else { return nil }

        func search(_ entries: [EPUBTOCEntry]) -> String? {
            for entry in entries {
                let entryBase = entry.href.components(separatedBy: "#").first ?? entry.href
                if href == entryBase || href.hasSuffix(entryBase) || entryBase.hasSuffix(href) {
                    return entry.title
                }
                if let found = search(entry.children) { return found }
            }
            return nil
        }

        return search(parser.package.tocItems)
    }

    // MARK: - ReaderEngine Protocol

    func makeViewController() -> UIViewController {
        pageViewController ?? UIViewController()
    }

    func goForward() async {
        guard let pages = chapterPages[currentSpineIndex] else { return }

        if currentPageIndex < pages.count - 1 {
            currentPageIndex += 1
            pageViewController?.showPage(currentPageIndex)
            updateLocation()
        } else {
            // End of chapter — load next spine item
            let nextIndex = currentSpineIndex + 1
            if nextIndex < (parser?.package.spine.count ?? 0) {
                loadChapter(at: nextIndex)
            }
        }
    }

    func goBackward() async {
        if currentPageIndex > 0 {
            currentPageIndex -= 1
            pageViewController?.showPage(currentPageIndex)
            updateLocation()
        } else {
            // Start of chapter — load previous spine item at last page
            let prevIndex = currentSpineIndex - 1
            if prevIndex >= 0 {
                loadChapter(at: prevIndex, startAtEnd: true)
            }
        }
    }

    func go(to location: ReaderLocation) async {
        guard let parser = parser, let href = location.href else { return }

        for (index, spineItem) in parser.package.spine.enumerated() {
            guard let manifest = parser.package.manifest[spineItem.idref] else { continue }
            let manifestBase = manifest.href.components(separatedBy: "#").first ?? manifest.href
            let hrefBase = href.components(separatedBy: "#").first ?? href

            if manifest.href == href || manifestBase == hrefBase
                || href.hasSuffix(manifestBase) || manifestBase.hasSuffix(hrefBase) {

                if index != currentSpineIndex {
                    loadChapter(at: index, progression: location.progression)
                } else if location.progression > 0 {
                    pageViewController?.showProgression(location.progression)
                    currentPageIndex = pageViewController?.currentPageIndex ?? 0
                    updateLocation()
                }
                break
            }
        }
    }

    func go(toProgression progression: Double) async {
        guard parser != nil else { return }

        let totalPagesCount = max(1, spinePageCounts.reduce(0, +))
        let targetPage = Int(progression * Double(totalPagesCount))

        var accumulated = 0
        for (index, count) in spinePageCounts.enumerated() {
            if accumulated + count > targetPage {
                let pageInChapter = targetPage - accumulated
                let chapterProgression = count > 1 ? Double(pageInChapter) / Double(count - 1) : 0

                if index != currentSpineIndex {
                    loadChapter(at: index, progression: chapterProgression)
                } else {
                    pageViewController?.showProgression(chapterProgression)
                    currentPageIndex = pageViewController?.currentPageIndex ?? 0
                    updateLocation()
                }
                break
            }
            accumulated += count
        }
    }

    func tableOfContents() async -> [TOCItem] {
        guard let parser = parser else { return [] }

        let items = convertTOCEntries(parser.package.tocItems, level: 0)
        if !items.isEmpty { return items }

        // Fallback: build TOC from headings found in spine items
        return await buildTOCFromHeadings(parser: parser)
    }

    private func convertTOCEntries(_ entries: [EPUBTOCEntry], level: Int) -> [TOCItem] {
        entries.map { entry in
            TOCItem(
                id: entry.href,
                title: entry.title,
                location: ReaderLocation(
                    href: entry.href.components(separatedBy: "#").first ?? entry.href,
                    pageIndex: nil,
                    progression: 0,
                    totalProgression: 0,
                    title: entry.title
                ),
                level: level,
                children: convertTOCEntries(entry.children, level: level + 1)
            )
        }
    }

    /// Scan spine XHTML files for heading elements (h1–h3) to build a fallback TOC.
    private func buildTOCFromHeadings(parser: EPUBParser) async -> [TOCItem] {
        var items: [TOCItem] = []

        for (index, spineItem) in parser.package.spine.enumerated() {
            guard let manifest = parser.package.manifest[spineItem.idref],
                  let chapterURL = parser.resolveSpineItemURL(at: index),
                  let data = try? Data(contentsOf: chapterURL),
                  let html = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else {
                continue
            }

            do {
                let doc = try SwiftSoup.parse(html)
                let headings = try doc.select("h1, h2, h3")

                for heading in headings.array() {
                    let text = try heading.text().trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !text.isEmpty else { continue }

                    let tagName = heading.tagName()
                    let level: Int
                    switch tagName {
                    case "h1": level = 0
                    case "h2": level = 1
                    case "h3": level = 2
                    default: level = 0
                    }

                    let href = manifest.href
                    let item = TOCItem(
                        id: "\(href)#heading-\(items.count)",
                        title: text,
                        location: ReaderLocation(
                            href: href,
                            pageIndex: nil,
                            progression: 0,
                            totalProgression: 0,
                            title: text
                        ),
                        level: level,
                        children: []
                    )
                    items.append(item)
                }

                // If no headings found in this spine item, add a generic entry using filename
                if headings.isEmpty() {
                    let filename = chapterURL.deletingPathExtension().lastPathComponent
                        .replacingOccurrences(of: "_", with: " ")
                        .replacingOccurrences(of: "-", with: " ")
                    let capitalized = filename.prefix(1).uppercased() + filename.dropFirst()
                    items.append(TOCItem(
                        id: manifest.href,
                        title: capitalized,
                        location: ReaderLocation(
                            href: manifest.href,
                            pageIndex: nil,
                            progression: 0,
                            totalProgression: 0,
                            title: capitalized
                        ),
                        level: 0,
                        children: []
                    ))
                }
            } catch {
                logger.warning("Failed to parse headings from \(chapterURL.lastPathComponent): \(error)")
            }
        }

        return items
    }

    func applyHighlights(_ highlights: [BookHighlight]) {
        pendingHighlights = highlights
        applyHighlightsToCurrentPage()
    }

    private func applyHighlightsToCurrentPage() {
        guard let parser = parser else { return }
        let manifestItem = parser.manifestItem(forSpineIndex: currentSpineIndex)
        let currentHref = manifestItem?.href ?? ""

        // Filter highlights for current chapter
        let chapterHighlights = pendingHighlights.filter { highlight in
            guard let data = highlight.locatorJSON.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let href = json["href"] as? String else { return false }
            return href == currentHref || currentHref.hasSuffix(href) || href.hasSuffix(currentHref)
        }

        // Convert to native highlight ranges
        let ranges: [(id: String, range: NSRange, color: UIColor)] = chapterHighlights.compactMap { highlight in
            guard let data = highlight.locatorJSON.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let range = json["range"] as? [String: Any],
                  let startOffset = range["startOffset"] as? Int,
                  let endOffset = range["endOffset"] as? Int else { return nil }

            let nsRange = NSRange(location: startOffset, length: endOffset - startOffset)
            let color = UIColor(hex: highlight.color) ?? .yellow

            return (id: highlight.id, range: nsRange, color: color)
        }

        pageViewController?.applyHighlights(ranges)
    }

    func clearSelection() {
        pageViewController?.clearSelection()
    }

    func applySettings(_ settings: ReaderSettings) {
        // Compare against snapshot values (not the reference) to detect real changes
        let settingsChanged = settingsSnapshot == nil ||
            settingsSnapshot?.theme != settings.theme ||
            settingsSnapshot?.fontFamily != settings.fontFamily ||
            settingsSnapshot?.fontSize != settings.fontSize ||
            settingsSnapshot?.lineHeight != settings.lineHeight

        currentSettings = settings
        settingsSnapshot = SettingsSnapshot(
            theme: settings.theme,
            fontFamily: settings.fontFamily,
            fontSize: settings.fontSize,
            lineHeight: settings.lineHeight
        )

        guard settingsChanged, isReady else { return }

        // Invalidate cached attributed strings and paginations
        chapterStrings.removeAll()
        chapterPages.removeAll()
        chapterOffsetMaps.removeAll()

        // Apply theme immediately
        pageViewController?.applyTheme(backgroundColor: settings.theme.backgroundColor)

        // Rebuild current chapter preserving progression
        let savedProgression = currentLocation?.progression ?? 0
        loadChapter(at: currentSpineIndex, progression: savedProgression)
    }

    func serializeLocation() -> String? {
        guard let location = currentLocation else { return nil }
        let dict: [String: Any] = [
            "href": location.href ?? "",
            "locations": [
                "progression": location.progression,
                "totalProgression": location.totalProgression
            ],
            "title": location.title ?? ""
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    // MARK: - Search

    func search(query: String) async -> [ReaderSearchResult] {
        guard let parser = parser, !query.isEmpty else { return [] }

        var results: [ReaderSearchResult] = []
        let contextChars = 40

        for (spineIndex, spineItem) in parser.package.spine.enumerated() {
            // Get or parse chapter content
            let nodes: [ContentNode]
            if let cached = parsedChapters[spineIndex] {
                nodes = cached
            } else {
                guard let chapterURL = parser.resolveSpineItemURL(at: spineIndex),
                      let data = try? Data(contentsOf: chapterURL) else { continue }
                let baseURL = chapterURL.deletingLastPathComponent()
                let contentParser = XHTMLContentParser(data: data, baseURL: baseURL, stylesheet: bookStylesheet)
                let parsed = contentParser.parse()
                parsedChapters[spineIndex] = parsed
                nodes = parsed
            }

            // Extract plain text
            let plainText = Self.extractPlainText(from: nodes)
            guard !plainText.isEmpty else { continue }

            let manifest = parser.package.manifest[spineItem.idref]
            let href = manifest?.href
            let chapterTitle = findChapterTitle(for: href)

            // Find all matches (case-insensitive)
            var searchStart = plainText.startIndex

            while searchStart < plainText.endIndex {
                guard let matchRange = plainText.range(of: query, options: .caseInsensitive, range: searchStart..<plainText.endIndex) else {
                    break
                }

                // Build snippet with context
                let snippetStart = plainText.index(matchRange.lowerBound, offsetBy: -contextChars, limitedBy: plainText.startIndex) ?? plainText.startIndex
                let snippetEnd = plainText.index(matchRange.upperBound, offsetBy: contextChars, limitedBy: plainText.endIndex) ?? plainText.endIndex
                let snippet = String(plainText[snippetStart..<snippetEnd])

                // Calculate match range within snippet
                let matchOffsetInSnippet = plainText.distance(from: snippetStart, to: matchRange.lowerBound)
                let matchStartInSnippet = snippet.index(snippet.startIndex, offsetBy: matchOffsetInSnippet)
                let matchEndInSnippet = snippet.index(matchStartInSnippet, offsetBy: plainText.distance(from: matchRange.lowerBound, to: matchRange.upperBound))

                // Calculate progression within chapter
                let charOffset = plainText.distance(from: plainText.startIndex, to: matchRange.lowerBound)
                let chapterProgression = Double(charOffset) / Double(max(1, plainText.count))

                let location = ReaderLocation(
                    href: href,
                    pageIndex: nil,
                    progression: chapterProgression,
                    totalProgression: 0,
                    title: chapterTitle
                )

                let prefix = snippetStart > plainText.startIndex ? "..." : ""
                let suffix = snippetEnd < plainText.endIndex ? "..." : ""
                let displaySnippet = prefix + snippet + suffix

                // Adjust match range for prefix
                let adjustedStart = displaySnippet.index(displaySnippet.startIndex, offsetBy: prefix.count + matchOffsetInSnippet)
                let adjustedEnd = displaySnippet.index(adjustedStart, offsetBy: plainText.distance(from: matchRange.lowerBound, to: matchRange.upperBound))

                results.append(ReaderSearchResult(
                    location: location,
                    snippet: displaySnippet,
                    matchRange: adjustedStart..<adjustedEnd,
                    chapterTitle: chapterTitle
                ))

                searchStart = matchRange.upperBound
            }
        }

        return results
    }

    // MARK: - Plain Text Extraction

    private static func extractPlainText(from nodes: [ContentNode]) -> String {
        var text = ""
        for node in nodes {
            appendPlainText(from: node, to: &text)
        }
        return text
    }

    private static func appendPlainText(from node: ContentNode, to text: inout String) {
        switch node {
        case .paragraph(let runs, _), .heading(_, let runs, _):
            for run in runs {
                text += run.text
            }
            text += "\n"

        case .codeBlock(let code):
            text += code + "\n"

        case .list(_, let items, _):
            for item in items {
                for child in item.children {
                    appendPlainText(from: child, to: &text)
                }
            }

        case .blockquote(let children), .container(let children, _):
            for child in children {
                appendPlainText(from: child, to: &text)
            }

        case .table(let rows):
            for row in rows {
                for cell in row.cells {
                    for run in cell.runs {
                        text += run.text
                    }
                    text += "\t"
                }
                text += "\n"
            }

        case .image(_, let alt, _, _, _):
            if let alt = alt { text += alt + "\n" }

        case .horizontalRule:
            text += "\n"

        case .video, .audio:
            break
        }
    }
}

