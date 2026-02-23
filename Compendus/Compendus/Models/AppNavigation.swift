//
//  AppNavigation.swift
//  Compendus
//
//  Shared navigation state for cross-tab navigation
//

import SwiftUI

@Observable
class AppNavigation {
    var selectedTab: Int = 1
    var pendingSeriesFilter: String? = nil
}
