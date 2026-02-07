//
//  AppSettings.swift
//  Compendus
//
//  User preferences and app settings
//

import Foundation
import SwiftUI

/// Observable settings container for app preferences
@Observable
class AppSettings {
    /// Grid density preference for book grids
    var gridDensity: GridDensity {
        didSet {
            UserDefaults.standard.set(gridDensity.rawValue, forKey: "gridDensity")
        }
    }

    /// Color scheme preference
    var colorSchemePreference: ColorSchemePreference {
        didSet {
            UserDefaults.standard.set(colorSchemePreference.rawValue, forKey: "colorScheme")
        }
    }

    /// Last sync timestamp
    var lastSyncTime: Date? {
        didSet {
            UserDefaults.standard.set(lastSyncTime, forKey: "lastSyncTime")
        }
    }

    /// Whether to enable haptic feedback
    var hapticsEnabled: Bool {
        didSet {
            UserDefaults.standard.set(hapticsEnabled, forKey: "hapticsEnabled")
        }
    }

    /// Computed color scheme for the app
    var colorScheme: ColorScheme? {
        switch colorSchemePreference {
        case .system:
            return nil
        case .light:
            return .light
        case .dark:
            return .dark
        }
    }

    init() {
        // Load saved values from UserDefaults
        self.gridDensity = GridDensity(rawValue: UserDefaults.standard.string(forKey: "gridDensity") ?? "comfortable") ?? .comfortable
        self.colorSchemePreference = ColorSchemePreference(rawValue: UserDefaults.standard.string(forKey: "colorScheme") ?? "system") ?? .system
        self.lastSyncTime = UserDefaults.standard.object(forKey: "lastSyncTime") as? Date
        self.hapticsEnabled = UserDefaults.standard.object(forKey: "hapticsEnabled") as? Bool ?? true
    }

    /// Update the last sync time to now
    func updateLastSyncTime() {
        lastSyncTime = Date()
    }
}

/// Grid density options
enum GridDensity: String, CaseIterable, Identifiable {
    case comfortable = "comfortable"
    case compact = "compact"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .comfortable: return "Comfortable"
        case .compact: return "Compact"
        }
    }

    var minItemWidth: CGFloat {
        switch self {
        case .comfortable: return 150
        case .compact: return 120
        }
    }

    var maxItemWidth: CGFloat {
        switch self {
        case .comfortable: return 200
        case .compact: return 160
        }
    }

    var spacing: CGFloat {
        switch self {
        case .comfortable: return 12
        case .compact: return 8
        }
    }
}

/// Color scheme preference options
enum ColorSchemePreference: String, CaseIterable, Identifiable {
    case system = "system"
    case light = "light"
    case dark = "dark"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }

    var icon: String {
        switch self {
        case .system: return "circle.lefthalf.filled"
        case .light: return "sun.max"
        case .dark: return "moon"
        }
    }
}
