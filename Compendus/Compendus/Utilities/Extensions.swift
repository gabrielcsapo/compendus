//
//  Extensions.swift
//  Compendus
//
//  Swift extensions and utilities
//

import Foundation
import SwiftUI

// MARK: - View Extensions

extension View {
    /// Apply a modifier conditionally
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }

    /// Hide the view based on a condition
    @ViewBuilder
    func hidden(_ shouldHide: Bool) -> some View {
        if shouldHide {
            self.hidden()
        } else {
            self
        }
    }
}

// MARK: - String Extensions

extension String {
    /// Truncate string to a maximum length with ellipsis
    func truncated(to maxLength: Int) -> String {
        if self.count <= maxLength {
            return self
        }
        return String(self.prefix(maxLength - 3)) + "..."
    }

    /// Check if string is a valid URL
    var isValidURL: Bool {
        if let url = URL(string: self) {
            return url.scheme != nil && url.host != nil
        }
        return false
    }
}

// MARK: - Date Extensions

extension Date {
    /// Format date for display
    func formatted(style: DateFormatter.Style) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = style
        formatter.timeStyle = .none
        return formatter.string(from: self)
    }

    /// Relative time string (e.g., "2 hours ago")
    var relativeString: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}

// MARK: - Collection Extensions

extension Collection {
    /// Safe subscript that returns nil for out-of-bounds indices
    subscript(safe index: Index) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}

// MARK: - Data Extensions

extension Data {
    /// Format data size as human-readable string
    var formattedSize: String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(self.count))
    }
}

// MARK: - Int Extensions

extension Int {
    /// Format bytes as human-readable string
    var formattedBytes: String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(self))
    }
}

extension Int64 {
    /// Format bytes as human-readable string
    var formattedBytes: String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: self)
    }
}

// MARK: - Double Extensions

extension Double {
    /// Format duration in seconds to time string
    var formattedDuration: String {
        let hours = Int(self) / 3600
        let minutes = (Int(self) % 3600) / 60
        let seconds = Int(self) % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        }
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - Color Extensions

extension Color {
    /// Create color from hex string
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
