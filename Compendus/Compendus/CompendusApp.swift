//
//  CompendusApp.swift
//  Compendus
//
//  Personal book library app for iOS
//

import SwiftUI
import SwiftData

@main
struct CompendusApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            DownloadedBook.self,
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    @State private var serverConfig = ServerConfig()
    @State private var storageManager = StorageManager()

    // These are created lazily based on serverConfig
    @State private var apiService: APIService
    @State private var downloadManager: DownloadManager

    init() {
        let config = ServerConfig()
        let api = APIService(config: config)
        let download = DownloadManager(config: config, apiService: api)

        _serverConfig = State(initialValue: config)
        _apiService = State(initialValue: api)
        _downloadManager = State(initialValue: download)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(serverConfig)
                .environment(storageManager)
                .environment(apiService)
                .environment(downloadManager)
        }
        .modelContainer(sharedModelContainer)
    }
}
