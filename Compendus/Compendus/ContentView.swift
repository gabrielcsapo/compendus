//
//  ContentView.swift
//  Compendus
//
//  Main navigation with TabView for Library, Downloads, and Settings
//

import SwiftUI
import SwiftData

struct ContentView: View {
    @Environment(ServerConfig.self) private var serverConfig
    @State private var selectedTab = 0

    var body: some View {
        Group {
            if serverConfig.isConfigured {
                TabView(selection: $selectedTab) {
                    LibraryView()
                        .tabItem {
                            Label("Library", systemImage: "books.vertical")
                        }
                        .tag(0)

                    DownloadsView()
                        .tabItem {
                            Label("Downloads", systemImage: "arrow.down.circle")
                        }
                        .tag(1)

                    SettingsView()
                        .tabItem {
                            Label("Settings", systemImage: "gear")
                        }
                        .tag(2)
                }
            } else {
                ServerSetupView()
            }
        }
    }
}

/// Initial setup view when server is not configured
struct ServerSetupView: View {
    @Environment(ServerConfig.self) private var serverConfig
    @State private var serverURL = ""
    @State private var isTestingConnection = false
    @State private var connectionError: String?
    @State private var showingError = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()

                VStack(spacing: 16) {
                    Image(systemName: "books.vertical.fill")
                        .font(.system(size: 80))
                        .foregroundStyle(.blue)

                    Text("Compendus")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    Text("Connect to your library server")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 16) {
                    TextField("Server URL (e.g., 192.168.1.100:5173)", text: $serverURL)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .padding(.horizontal)

                    Button {
                        testAndSaveConnection()
                    } label: {
                        HStack {
                            if isTestingConnection {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            }
                            Text(isTestingConnection ? "Connecting..." : "Connect")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(serverURL.isEmpty ? Color.gray : Color.blue)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(serverURL.isEmpty || isTestingConnection)
                    .padding(.horizontal)
                }

                Spacer()

                Text("Make sure your Compendus server is running and accessible on the same network.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()
            }
            .navigationTitle("Setup")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Connection Failed", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(connectionError ?? "Unable to connect to the server. Please check the URL and try again.")
            }
        }
    }

    private func testAndSaveConnection() {
        isTestingConnection = true
        connectionError = nil

        // Temporarily set the URL for testing
        let tempConfig = ServerConfig()
        tempConfig.serverURL = serverURL

        Task {
            let success = await tempConfig.testConnection()

            await MainActor.run {
                isTestingConnection = false

                if success {
                    serverConfig.serverURL = serverURL
                } else {
                    connectionError = "Unable to connect to the server. Please check the URL and make sure the server is running."
                    showingError = true
                }
            }
        }
    }
}

#Preview {
    ContentView()
        .environment(ServerConfig())
        .environment(StorageManager())
        .modelContainer(for: DownloadedBook.self, inMemory: true)
}
