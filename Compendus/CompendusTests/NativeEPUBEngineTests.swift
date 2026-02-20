//
//  NativeEPUBEngineTests.swift
//  CompendusTests
//
//  Integration tests loading real sample EPUBs through the full native pipeline.
//

import XCTest
@testable import Compendus

@MainActor
final class NativeEPUBEngineTests: XCTestCase {

    /// Helper: parse an EPUB, build attributed string for first chapter, paginate it.
    /// Returns (parser, nodes, attributedString, pages).
    private func loadChapterPipeline(named name: String, spineIndex: Int = 0) async throws -> (
        parser: EPUBParser,
        nodes: [ContentNode],
        attributedString: NSAttributedString,
        pages: [PageInfo]
    ) {
        let url = try XCTUnwrap(TestHelpers.sampleEPUBURL(named: name))
        let parser = try await EPUBParser.parse(epubURL: url)

        let chapterURL = try XCTUnwrap(parser.resolveSpineItemURL(at: spineIndex))
        let data = try Data(contentsOf: chapterURL)
        let baseURL = chapterURL.deletingLastPathComponent()

        let contentParser = XHTMLContentParser(data: data, baseURL: baseURL)
        let nodes = contentParser.parse()

        let settings = ReaderSettings()
        let contentWidth: CGFloat = 326 // 390 - 32*2 insets
        let builder = AttributedStringBuilder(settings: settings, contentWidth: contentWidth)
        let (attrString, _) = builder.build(from: nodes)

        let viewport = CGSize(width: 390, height: 844)
        let pages = NativePaginationEngine.paginate(
            attributedString: attrString,
            viewportSize: viewport
        )

        return (parser, nodes, attrString, pages)
    }

    // MARK: - Pipeline Tests

    func testHeftyWaterPipeline() async throws {
        let (parser, nodes, attrString, pages) = try await loadChapterPipeline(named: "hefty-water.epub")

        XCTAssertGreaterThan(parser.package.spine.count, 0)
        XCTAssertGreaterThan(nodes.count, 0, "Should have content nodes")
        XCTAssertGreaterThan(attrString.length, 0, "Should produce attributed string")
        XCTAssertGreaterThan(pages.count, 0, "Should have at least one page")
    }

    func testMobyDickPipeline() async throws {
        let url = try XCTUnwrap(TestHelpers.sampleEPUBURL(named: "moby-dick.epub"))
        let parser = try await EPUBParser.parse(epubURL: url)

        // Find a content chapter (not cover/title)
        let chapterIndex = min(3, parser.package.spine.count - 1)
        let (_, nodes, attrString, pages) = try await loadChapterPipeline(
            named: "moby-dick.epub",
            spineIndex: chapterIndex
        )

        XCTAssertGreaterThan(nodes.count, 0, "Content chapter should have nodes")
        XCTAssertGreaterThan(attrString.length, 0, "Should produce attributed string")
        XCTAssertGreaterThanOrEqual(pages.count, 1, "Should have pages")
    }

    // MARK: - Search Tests

    func testSearchFindsText() async throws {
        let url = try XCTUnwrap(TestHelpers.sampleEPUBURL(named: "moby-dick.epub"))
        let engine = NativeEPUBEngine(bookURL: url)
        await engine.load()

        let results = await engine.search(query: "whale")
        XCTAssertGreaterThan(results.count, 0, "Should find 'whale' in Moby Dick")

        // Verify results have valid data
        for result in results.prefix(5) {
            XCTAssertFalse(result.snippet.isEmpty, "Snippet should not be empty")
            XCTAssertNotNil(result.location.href, "Result should have an href")
        }
    }

    func testSearchCaseInsensitive() async throws {
        let url = try XCTUnwrap(TestHelpers.sampleEPUBURL(named: "moby-dick.epub"))
        let engine = NativeEPUBEngine(bookURL: url)
        await engine.load()

        let lower = await engine.search(query: "whale")
        let upper = await engine.search(query: "WHALE")

        // Both should find results (case insensitive)
        XCTAssertGreaterThan(lower.count, 0)
        XCTAssertGreaterThan(upper.count, 0)
        // They should find the same number of matches
        XCTAssertEqual(lower.count, upper.count,
                       "Case-insensitive search should find same results")
    }

    func testSearchEmptyQuery() async throws {
        let url = try XCTUnwrap(TestHelpers.sampleEPUBURL(named: "moby-dick.epub"))
        let engine = NativeEPUBEngine(bookURL: url)
        await engine.load()

        let results = await engine.search(query: "")
        XCTAssertTrue(results.isEmpty, "Empty query should return no results")
    }

    func testSearchNoResults() async throws {
        let url = try XCTUnwrap(TestHelpers.sampleEPUBURL(named: "hefty-water.epub"))
        let engine = NativeEPUBEngine(bookURL: url)
        await engine.load()

        let results = await engine.search(query: "xyznonexistentterm123")
        XCTAssertTrue(results.isEmpty, "Nonsense query should return no results")
    }

    // MARK: - Table of Contents

    func testTableOfContents() async throws {
        let url = try XCTUnwrap(TestHelpers.sampleEPUBURL(named: "moby-dick.epub"))
        let engine = NativeEPUBEngine(bookURL: url)
        await engine.load()

        let toc = await engine.tableOfContents()
        XCTAssertGreaterThan(toc.count, 0, "Moby Dick should have TOC entries")

        for item in toc.prefix(5) {
            XCTAssertFalse(item.title.isEmpty, "TOC item should have a title")
        }
    }

    // MARK: - CSS Pipeline Tests

    /// Helper: load CSS stylesheets from an EPUB parser, same as NativeEPUBEngine does.
    private func loadStylesheets(from parser: EPUBParser) -> CSSStylesheet {
        var combined = CSSStylesheet()
        for (_, item) in parser.package.manifest {
            guard item.mediaType == "text/css" else { continue }
            let cssURL = parser.resolveURL(for: item)
            guard let cssData = try? Data(contentsOf: cssURL),
                  let cssText = String(data: cssData, encoding: .utf8) else { continue }
            let parsed = CSSParser.parse(cssText)
            combined.merge(with: parsed)
        }
        return combined
    }

    func testAccessibleEPUB3WithCSS() async throws {
        let url = try XCTUnwrap(TestHelpers.sampleEPUBURL(named: "accessible_epub_3.epub"))
        let parser = try await EPUBParser.parse(epubURL: url)

        // Load CSS the same way NativeEPUBEngine does
        let stylesheet = loadStylesheets(from: parser)

        // Test the chapter 1 content (index may vary, find a content chapter)
        for spineIndex in 0..<min(5, parser.package.spine.count) {
            guard let chapterURL = parser.resolveSpineItemURL(at: spineIndex),
                  let data = try? Data(contentsOf: chapterURL) else { continue }

            let baseURL = chapterURL.deletingLastPathComponent()

            // Parse WITHOUT CSS (baseline)
            let parserNoCSS = XHTMLContentParser(data: data, baseURL: baseURL)
            let nodesNoCSS = parserNoCSS.parse()

            // Parse WITH CSS (the new code path)
            let parserWithCSS = XHTMLContentParser(data: data, baseURL: baseURL, stylesheet: stylesheet)
            let nodesWithCSS = parserWithCSS.parse()

            let settings = ReaderSettings()
            let contentWidth: CGFloat = 326

            // Build WITHOUT CSS
            let builderNoCSS = AttributedStringBuilder(settings: settings, contentWidth: contentWidth)
            let (attrNoCSS, _) = builderNoCSS.build(from: nodesNoCSS)

            // Build WITH CSS
            let builderWithCSS = AttributedStringBuilder(settings: settings, contentWidth: contentWidth)
            let (attrWithCSS, _) = builderWithCSS.build(from: nodesWithCSS)

            let spineItem = parser.package.spine[spineIndex]
            let href = parser.package.manifest[spineItem.idref]?.href ?? "unknown"

            XCTAssertGreaterThan(nodesNoCSS.count, 0,
                "\(href): should have nodes without CSS")
            XCTAssertGreaterThan(nodesWithCSS.count, 0,
                "\(href): should have nodes with CSS")
            XCTAssertGreaterThan(attrNoCSS.length, 0,
                "\(href): should produce content without CSS")
            XCTAssertGreaterThan(attrWithCSS.length, 0,
                "\(href): should produce content WITH CSS (regression!)")

            // The CSS version shouldn't produce dramatically less content
            if attrNoCSS.length > 10 {
                let ratio = Double(attrWithCSS.length) / Double(attrNoCSS.length)
                XCTAssertGreaterThan(ratio, 0.5,
                    "\(href): CSS version has \(attrWithCSS.length) chars vs \(attrNoCSS.length) without CSS — too much content lost")
            }
        }
    }

    func testCSSDoesNotSetDisplayNoneOnCommonElements() async throws {
        let url = try XCTUnwrap(TestHelpers.sampleEPUBURL(named: "accessible_epub_3.epub"))
        let parser = try await EPUBParser.parse(epubURL: url)
        let stylesheet = loadStylesheets(from: parser)

        // Check that common elements don't resolve to display: none
        let commonElements = ["p", "h1", "h2", "h3", "section", "div", "body", "nav", "ol", "ul", "li"]
        for element in commonElements {
            let props = stylesheet.resolve(element: element, classes: [])
            XCTAssertNotEqual(props.display, CSSDisplay.none,
                "Element '\(element)' should NOT have display: none")
        }

        // Check common classes too
        let commonClasses = [["chapter"], ["title"], ["sect1"], ["preface"], ["itemizedlist"], ["listitem"]]
        for classes in commonClasses {
            let propsSection = stylesheet.resolve(element: "section", classes: classes)
            XCTAssertNotEqual(propsSection.display, CSSDisplay.none,
                "section.\(classes.joined(separator: ".")) should NOT have display: none")
            let propsDiv = stylesheet.resolve(element: "div", classes: classes)
            XCTAssertNotEqual(propsDiv.display, CSSDisplay.none,
                "div.\(classes.joined(separator: ".")) should NOT have display: none")
        }
    }

    func testAllSamplesWithCSSPipeline() async throws {
        let samples = TestHelpers.allSampleEPUBNames
        XCTAssertGreaterThan(samples.count, 0, "Should have sample EPUBs")

        for name in samples {
            let url = try XCTUnwrap(TestHelpers.sampleEPUBURL(named: name), "Missing: \(name)")

            do {
                let parser = try await EPUBParser.parse(epubURL: url)
                guard parser.package.spine.count > 0 else {
                    XCTFail("\(name): no spine items")
                    continue
                }

                // Load CSS like the engine does
                let stylesheet = loadStylesheets(from: parser)

                guard let chapterURL = parser.resolveSpineItemURL(at: 0),
                      let data = try? Data(contentsOf: chapterURL) else {
                    XCTFail("\(name): could not load first chapter")
                    continue
                }

                let baseURL = chapterURL.deletingLastPathComponent()
                let contentParser = XHTMLContentParser(data: data, baseURL: baseURL, stylesheet: stylesheet)
                let nodes = contentParser.parse()

                let settings = ReaderSettings()
                let builder = AttributedStringBuilder(settings: settings, contentWidth: 326)
                let (attrString, _) = builder.build(from: nodes)

                let viewport = CGSize(width: 390, height: 844)
                let pages = NativePaginationEngine.paginate(
                    attributedString: attrString,
                    viewportSize: viewport
                )

                XCTAssertGreaterThanOrEqual(pages.count, 1,
                    "\(name) (with CSS): should produce at least one page")
            } catch {
                XCTFail("\(name): pipeline failed — \(error.localizedDescription)")
            }
        }
    }

    // MARK: - All Samples

    func testAllSamplesLoadPipeline() async throws {
        let samples = TestHelpers.allSampleEPUBNames
        XCTAssertGreaterThan(samples.count, 0, "Should have sample EPUBs")

        for name in samples {
            let url = try XCTUnwrap(TestHelpers.sampleEPUBURL(named: name), "Missing: \(name)")

            do {
                let parser = try await EPUBParser.parse(epubURL: url)
                guard parser.package.spine.count > 0 else {
                    XCTFail("\(name): no spine items")
                    continue
                }

                // Try parsing the first spine item through the content pipeline
                guard let chapterURL = parser.resolveSpineItemURL(at: 0),
                      let data = try? Data(contentsOf: chapterURL) else {
                    XCTFail("\(name): could not load first chapter")
                    continue
                }

                let baseURL = chapterURL.deletingLastPathComponent()
                let contentParser = XHTMLContentParser(data: data, baseURL: baseURL)
                let nodes = contentParser.parse()

                // Some EPUBs have cover pages with just an image — nodes might be few
                // but should not crash
                let settings = ReaderSettings()
                let builder = AttributedStringBuilder(settings: settings, contentWidth: 326)
                let (attrString, _) = builder.build(from: nodes)

                let viewport = CGSize(width: 390, height: 844)
                let pages = NativePaginationEngine.paginate(
                    attributedString: attrString,
                    viewportSize: viewport
                )

                XCTAssertGreaterThanOrEqual(pages.count, 1,
                    "\(name): should produce at least one page")
            } catch {
                XCTFail("\(name): pipeline failed — \(error.localizedDescription)")
            }
        }
    }
}
