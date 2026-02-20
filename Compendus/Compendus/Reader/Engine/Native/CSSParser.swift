//
//  CSSParser.swift
//  Compendus
//
//  Lightweight CSS parser for EPUB stylesheets.
//  Extracts class-based styles into a lookup table for use by XHTMLContentParser.
//  Supports class selectors, element selectors, and simple compound selectors.
//  Does NOT implement full CSS cascade — only flat rule matching.
//

import Foundation
import UIKit

// MARK: - CSS Value Types

/// A CSS length value with unit.
enum CSSLength: Equatable, Hashable {
    case em(CGFloat)
    case px(CGFloat)
    case percent(CGFloat)
    case zero

    /// Resolve to points relative to a base font size.
    func resolve(relativeTo fontSize: CGFloat) -> CGFloat {
        switch self {
        case .em(let value): return value * fontSize
        case .px(let value): return value
        case .percent(let value): return value / 100.0 * fontSize
        case .zero: return 0
        }
    }
}

enum CSSFontStyle: Equatable { case italic, normal }
enum CSSFontWeight: Equatable { case bold, normal }
enum CSSFontVariant: Equatable { case smallCaps, normal }
enum CSSTextAlign: Equatable { case left, center, right, justify }
enum CSSTextTransform: Equatable { case uppercase, lowercase, capitalize }
enum CSSTextDecoration: Equatable { case underline, lineThrough }
enum CSSDisplay: Equatable { case none, block, inline }
enum CSSListStyleType: Equatable { case disc, circle, square, decimal, lowerAlpha, lowerRoman, none }
enum CSSFloat: Equatable { case left, right, none }

// MARK: - CSS Properties

/// Resolved CSS properties for an element. All fields are optional;
/// nil means the property was not specified.
struct CSSProperties: Equatable {
    var fontStyle: CSSFontStyle?
    var fontWeight: CSSFontWeight?
    var fontVariant: CSSFontVariant?
    var textAlign: CSSTextAlign?
    var textIndent: CSSLength?
    var marginTop: CSSLength?
    var marginBottom: CSSLength?
    var marginLeft: CSSLength?
    var marginRight: CSSLength?
    var textTransform: CSSTextTransform?
    var textDecoration: CSSTextDecoration?
    var display: CSSDisplay?
    var listStyleType: CSSListStyleType?
    var cssFloat: CSSFloat?
    var width: CSSLength?
    var height: CSSLength?

    static let empty = CSSProperties()

    /// Merge: non-nil values from `other` override self.
    func merging(with other: CSSProperties) -> CSSProperties {
        var result = self
        if let v = other.fontStyle { result.fontStyle = v }
        if let v = other.fontWeight { result.fontWeight = v }
        if let v = other.fontVariant { result.fontVariant = v }
        if let v = other.textAlign { result.textAlign = v }
        if let v = other.textIndent { result.textIndent = v }
        if let v = other.marginTop { result.marginTop = v }
        if let v = other.marginBottom { result.marginBottom = v }
        if let v = other.marginLeft { result.marginLeft = v }
        if let v = other.marginRight { result.marginRight = v }
        if let v = other.textTransform { result.textTransform = v }
        if let v = other.textDecoration { result.textDecoration = v }
        if let v = other.display { result.display = v }
        if let v = other.listStyleType { result.listStyleType = v }
        if let v = other.cssFloat { result.cssFloat = v }
        if let v = other.width { result.width = v }
        if let v = other.height { result.height = v }
        return result
    }
}

// MARK: - CSS Selector

/// A parsed CSS selector with specificity for ordering.
private struct CSSRule {
    enum SelectorKind: Hashable {
        case element(String)                    // "p"
        case className(String)                  // ".italic"
        case elementClass(String, String)       // "span.italic"
        case idSelector(String)                 // "#video1"
    }

    let selector: SelectorKind
    let properties: CSSProperties

    /// Specificity for rule ordering (higher wins).
    var specificity: Int {
        switch selector {
        case .element: return 1
        case .className: return 10
        case .elementClass: return 11
        case .idSelector: return 100
        }
    }
}

// MARK: - CSS Stylesheet

/// A parsed CSS stylesheet with fast class-based lookup.
struct CSSStylesheet {
    private var elementRules: [String: CSSProperties] = [:]
    private var classRules: [String: CSSProperties] = [:]
    private var elementClassRules: [String: CSSProperties] = [:] // "element.class" key
    private var idRules: [String: CSSProperties] = [:]

    /// Resolve styles for an element given its tag name, CSS classes, and optional ID.
    func resolve(element: String, classes: [String], id: String? = nil) -> CSSProperties {
        var result = CSSProperties.empty

        // 1. Element rules (lowest specificity)
        if let props = elementRules[element] {
            result = result.merging(with: props)
        }

        // 2. Class rules (medium specificity)
        for cls in classes {
            if let props = classRules[cls] {
                result = result.merging(with: props)
            }
        }

        // 3. Element.class rules
        for cls in classes {
            let key = "\(element).\(cls)"
            if let props = elementClassRules[key] {
                result = result.merging(with: props)
            }
        }

        // 4. ID rules (highest specificity)
        if let id = id, let props = idRules[id] {
            result = result.merging(with: props)
        }

        return result
    }

    /// Merge another stylesheet into this one (later rules win).
    mutating func merge(with other: CSSStylesheet) {
        for (key, props) in other.elementRules {
            elementRules[key] = (elementRules[key] ?? .empty).merging(with: props)
        }
        for (key, props) in other.classRules {
            classRules[key] = (classRules[key] ?? .empty).merging(with: props)
        }
        for (key, props) in other.elementClassRules {
            elementClassRules[key] = (elementClassRules[key] ?? .empty).merging(with: props)
        }
        for (key, props) in other.idRules {
            idRules[key] = (idRules[key] ?? .empty).merging(with: props)
        }
    }

    fileprivate mutating func addRule(_ rule: CSSRule) {
        switch rule.selector {
        case .element(let el):
            elementRules[el] = (elementRules[el] ?? .empty).merging(with: rule.properties)
        case .className(let cls):
            classRules[cls] = (classRules[cls] ?? .empty).merging(with: rule.properties)
        case .elementClass(let el, let cls):
            let key = "\(el).\(cls)"
            elementClassRules[key] = (elementClassRules[key] ?? .empty).merging(with: rule.properties)
        case .idSelector(let id):
            idRules[id] = (idRules[id] ?? .empty).merging(with: rule.properties)
        }
    }
}

// MARK: - CSS Parser

enum CSSParser {

    /// Parse a CSS string into a CSSStylesheet.
    static func parse(_ css: String) -> CSSStylesheet {
        var stylesheet = CSSStylesheet()
        let cleaned = stripComments(css)
        let rules = extractRules(from: cleaned)

        for (selectorText, declarationText) in rules {
            let properties = parseDeclarations(declarationText)
            let selectors = parseSelectors(selectorText)
            for selector in selectors {
                stylesheet.addRule(CSSRule(selector: selector, properties: properties))
            }
        }

        return stylesheet
    }

    // MARK: - Comment Stripping

    private static func stripComments(_ css: String) -> String {
        var result = ""
        result.reserveCapacity(css.count)
        var i = css.startIndex
        while i < css.endIndex {
            let next = css.index(after: i)
            if next < css.endIndex && css[i] == "/" && css[next] == "*" {
                // Find closing */
                var j = css.index(after: next)
                while j < css.endIndex {
                    let jNext = css.index(after: j)
                    if jNext <= css.endIndex && css[j] == "*" && jNext < css.endIndex && css[jNext] == "/" {
                        i = css.index(after: jNext)
                        break
                    }
                    j = css.index(after: j)
                }
                if j >= css.endIndex { break }
            } else {
                result.append(css[i])
                i = css.index(after: i)
            }
        }
        return result
    }

    // MARK: - Rule Extraction

    /// Extract (selector, declarations) pairs, skipping @-blocks.
    private static func extractRules(from css: String) -> [(String, String)] {
        var rules: [(String, String)] = []
        var i = css.startIndex
        var selectorBuffer = ""

        while i < css.endIndex {
            let ch = css[i]

            if ch == "@" {
                // Skip @-block by counting braces
                var braceDepth = 0
                var foundBrace = false
                while i < css.endIndex {
                    let c = css[i]
                    if c == "{" {
                        braceDepth += 1
                        foundBrace = true
                    } else if c == "}" {
                        braceDepth -= 1
                        if foundBrace && braceDepth <= 0 {
                            i = css.index(after: i)
                            break
                        }
                    } else if c == ";" && !foundBrace {
                        // @import without braces
                        i = css.index(after: i)
                        break
                    }
                    i = css.index(after: i)
                }
                selectorBuffer = ""
                continue
            }

            if ch == "{" {
                // Find matching closing brace
                var braceDepth = 1
                var declarationBuffer = ""
                i = css.index(after: i)
                while i < css.endIndex && braceDepth > 0 {
                    let c = css[i]
                    if c == "{" { braceDepth += 1 }
                    else if c == "}" { braceDepth -= 1 }
                    if braceDepth > 0 {
                        declarationBuffer.append(c)
                    }
                    i = css.index(after: i)
                }

                let selector = selectorBuffer.trimmingCharacters(in: .whitespacesAndNewlines)
                if !selector.isEmpty {
                    rules.append((selector, declarationBuffer))
                }
                selectorBuffer = ""
                continue
            }

            selectorBuffer.append(ch)
            i = css.index(after: i)
        }

        return rules
    }

    // MARK: - Selector Parsing

    /// Parse a selector string into individual selector kinds.
    /// Handles comma-separated groups.
    private static func parseSelectors(_ text: String) -> [CSSRule.SelectorKind] {
        let parts = text.split(separator: ",").map {
            $0.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        var selectors: [CSSRule.SelectorKind] = []
        for part in parts {
            if let selector = parseSingleSelector(part) {
                selectors.append(selector)
            }
        }
        return selectors
    }

    /// Parse a single selector (no commas).
    /// For descendant selectors like "div.x p", we only use the rightmost part.
    private static func parseSingleSelector(_ text: String) -> CSSRule.SelectorKind? {
        // Take the last segment of descendant selectors
        let segments = text.split(separator: " ").map(String.init)
        guard let last = segments.last else { return nil }

        // Handle #id selectors
        if last.hasPrefix("#") {
            let id = String(last.dropFirst())
            return id.isEmpty ? nil : .idSelector(id)
        }

        // Handle element.class compound
        if let dotIndex = last.firstIndex(of: ".") {
            let element = String(last[last.startIndex..<dotIndex])
            let className = String(last[last.index(after: dotIndex)...])
            if element.isEmpty {
                // Pure class selector: .className
                return className.isEmpty ? nil : .className(className)
            } else {
                return .elementClass(element, className)
            }
        }

        // Pure element selector
        let trimmed = last.trimmingCharacters(in: .whitespacesAndNewlines)
        // Skip pseudo-selectors and complex selectors
        if trimmed.contains(":") || trimmed.contains("[") || trimmed.contains(">") ||
           trimmed.contains("+") || trimmed.contains("~") {
            return nil
        }
        return trimmed.isEmpty ? nil : .element(trimmed)
    }

    // MARK: - Declaration Parsing

    /// Parse a declaration block into CSSProperties.
    private static func parseDeclarations(_ text: String) -> CSSProperties {
        var props = CSSProperties()
        let declarations = text.split(separator: ";")

        for decl in declarations {
            // Split on first colon only
            guard let colonIndex = decl.firstIndex(of: ":") else { continue }
            let property = decl[decl.startIndex..<colonIndex]
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            let rawValue = decl[decl.index(after: colonIndex)...]
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            // Strip !important
            let value = rawValue.replacingOccurrences(of: "!important", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)

            switch property {
            case "font-style":
                if value == "italic" || value == "oblique" { props.fontStyle = .italic }
                else if value == "normal" { props.fontStyle = .normal }

            case "font-weight":
                if value == "bold" || value == "bolder" { props.fontWeight = .bold }
                else if value == "normal" || value == "lighter" { props.fontWeight = .normal }
                else if let num = Int(value), num >= 600 { props.fontWeight = .bold }
                else if let num = Int(value), num < 600 { props.fontWeight = .normal }

            case "font-variant", "font-variant-caps":
                if value.contains("small-caps") { props.fontVariant = .smallCaps }
                else if value == "normal" { props.fontVariant = .normal }

            case "text-align":
                if value == "center" { props.textAlign = .center }
                else if value == "right" { props.textAlign = .right }
                else if value == "left" || value == "start" { props.textAlign = .left }
                else if value == "justify" { props.textAlign = .justify }

            case "text-indent":
                if let length = parseLength(value) { props.textIndent = length }

            case "margin-top":
                if let length = parseLength(value) { props.marginTop = length }

            case "margin-bottom":
                if let length = parseLength(value) { props.marginBottom = length }

            case "margin-left":
                if let length = parseLength(value) { props.marginLeft = length }

            case "margin-right":
                if let length = parseLength(value) { props.marginRight = length }

            case "margin":
                parseMarginShorthand(value, into: &props)

            case "text-transform":
                if value == "uppercase" { props.textTransform = .uppercase }
                else if value == "lowercase" { props.textTransform = .lowercase }
                else if value == "capitalize" { props.textTransform = .capitalize }

            case "text-decoration", "text-decoration-line":
                if value.contains("underline") { props.textDecoration = .underline }
                else if value.contains("line-through") { props.textDecoration = .lineThrough }

            case "display":
                if value == "none" { props.display = .none }
                else if value == "block" { props.display = .block }
                else if value == "inline" { props.display = .inline }

            case "list-style-type", "list-style":
                if value.contains("none") { props.listStyleType = .none }
                else if value.contains("disc") { props.listStyleType = .disc }
                else if value.contains("circle") { props.listStyleType = .circle }
                else if value.contains("square") { props.listStyleType = .square }
                else if value.contains("decimal") { props.listStyleType = .decimal }
                else if value.contains("lower-alpha") || value.contains("lower-latin") {
                    props.listStyleType = .lowerAlpha
                }
                else if value.contains("lower-roman") { props.listStyleType = .lowerRoman }

            case "float":
                if value == "left" { props.cssFloat = .left }
                else if value == "right" { props.cssFloat = .right }
                else if value == "none" { props.cssFloat = .none }

            case "width":
                if let length = parseLength(value) { props.width = length }

            case "height":
                if let length = parseLength(value) { props.height = length }

            default:
                break
            }
        }

        return props
    }

    // MARK: - Length Parsing

    /// Parse a CSS length value (e.g. "1.42em", "20px", "75%", "0").
    private static func parseLength(_ value: String) -> CSSLength? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed == "0" || trimmed == "0px" || trimmed == "0em" {
            return .zero
        }

        if trimmed.hasSuffix("em") {
            let numStr = String(trimmed.dropLast(2)).trimmingCharacters(in: .whitespaces)
            if let num = Double(numStr) { return .em(CGFloat(num)) }
        } else if trimmed.hasSuffix("rem") {
            let numStr = String(trimmed.dropLast(3)).trimmingCharacters(in: .whitespaces)
            if let num = Double(numStr) { return .em(CGFloat(num)) } // treat rem as em
        } else if trimmed.hasSuffix("px") {
            let numStr = String(trimmed.dropLast(2)).trimmingCharacters(in: .whitespaces)
            if let num = Double(numStr) { return .px(CGFloat(num)) }
        } else if trimmed.hasSuffix("pt") {
            let numStr = String(trimmed.dropLast(2)).trimmingCharacters(in: .whitespaces)
            if let num = Double(numStr) { return .px(CGFloat(num)) } // treat pt as px
        } else if trimmed.hasSuffix("%") {
            let numStr = String(trimmed.dropLast(1)).trimmingCharacters(in: .whitespaces)
            if let num = Double(numStr) { return .percent(CGFloat(num)) }
        } else if let num = Double(trimmed) {
            // Bare number — treat as px
            return num == 0 ? .zero : .px(CGFloat(num))
        }

        return nil
    }

    // MARK: - Margin Shorthand

    /// Parse `margin` shorthand into individual margin properties.
    private static func parseMarginShorthand(_ value: String, into props: inout CSSProperties) {
        let parts = value.split(whereSeparator: { $0.isWhitespace })
            .map { String($0) }
            .compactMap { parseLength($0) }

        switch parts.count {
        case 1:
            // margin: V  → all four
            props.marginTop = parts[0]
            props.marginRight = parts[0]
            props.marginBottom = parts[0]
            props.marginLeft = parts[0]
        case 2:
            // margin: V H
            props.marginTop = parts[0]
            props.marginBottom = parts[0]
            props.marginRight = parts[1]
            props.marginLeft = parts[1]
        case 3:
            // margin: T H B
            props.marginTop = parts[0]
            props.marginRight = parts[1]
            props.marginLeft = parts[1]
            props.marginBottom = parts[2]
        case 4:
            // margin: T R B L
            props.marginTop = parts[0]
            props.marginRight = parts[1]
            props.marginBottom = parts[2]
            props.marginLeft = parts[3]
        default:
            break
        }
    }
}
