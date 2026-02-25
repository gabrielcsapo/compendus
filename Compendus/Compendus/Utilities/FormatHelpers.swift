//
//  FormatHelpers.swift
//  Compendus
//
//  Centralized format classification and badge view
//

import SwiftUI

struct FormatInfo {
    let icon: String
    let color: Color
    let isConvertible: Bool
    let conversionTarget: String?

    static func from(format: String) -> FormatInfo {
        switch format.lowercased() {
        case "epub":
            return FormatInfo(icon: "book.closed.fill", color: .blue, isConvertible: false, conversionTarget: nil)
        case "pdf":
            return FormatInfo(icon: "doc.fill", color: .red, isConvertible: false, conversionTarget: nil)
        case "mobi", "azw", "azw3":
            return FormatInfo(icon: "book.fill", color: .orange, isConvertible: true, conversionTarget: "EPUB")
        case "cbr":
            return FormatInfo(icon: "book.pages.fill", color: .purple, isConvertible: true, conversionTarget: "CBZ")
        case "cbz":
            return FormatInfo(icon: "book.pages.fill", color: .purple, isConvertible: false, conversionTarget: nil)
        case "m4b", "mp3", "m4a":
            return FormatInfo(icon: "headphones", color: .green, isConvertible: false, conversionTarget: nil)
        default:
            return FormatInfo(icon: "doc.fill", color: .gray, isConvertible: false, conversionTarget: nil)
        }
    }
}

struct FormatBadgeView: View {
    let format: String
    var size: BadgeSize = .standard
    var showConversionHint: Bool = false

    enum BadgeSize {
        case compact   // ContinueReadingSection
        case standard  // Grid items
        case detail    // Detail views
    }

    private var info: FormatInfo { FormatInfo.from(format: format) }

    var body: some View {
        HStack(spacing: iconSpacing) {
            Image(systemName: info.icon)
                .font(.system(size: iconSize))

            if showConversionHint, let target = info.conversionTarget {
                Text(format.uppercased())
                    .font(textFont)
                    .fontWeight(.medium)
                Image(systemName: "arrow.right")
                    .font(.system(size: iconSize * 0.8))
                Text(target)
                    .font(textFont)
                    .fontWeight(.medium)
            } else {
                Text(format.uppercased())
                    .font(textFont)
                    .fontWeight(.medium)
            }
        }
        .padding(.horizontal, horizontalPadding)
        .padding(.vertical, verticalPadding)
        .background(info.color.opacity(0.2))
        .foregroundStyle(info.color)
        .clipShape(Capsule())
        .accessibilityLabel("\(format.uppercased()) format\(showConversionHint && info.conversionTarget != nil ? ", convertible to \(info.conversionTarget!)" : "")")
    }

    private var iconSize: CGFloat {
        switch size {
        case .compact: return 8
        case .standard: return 9
        case .detail: return 10
        }
    }

    private var iconSpacing: CGFloat {
        switch size {
        case .compact: return 2
        case .standard, .detail: return 3
        }
    }

    private var textFont: Font {
        switch size {
        case .compact: return .system(size: 9)
        case .standard: return .caption2
        case .detail: return .caption
        }
    }

    private var horizontalPadding: CGFloat {
        switch size {
        case .compact: return 4
        case .standard: return 6
        case .detail: return 8
        }
    }

    private var verticalPadding: CGFloat {
        switch size {
        case .compact, .standard: return 2
        case .detail: return 4
        }
    }
}
