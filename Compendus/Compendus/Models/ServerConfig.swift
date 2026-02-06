//
//  ServerConfig.swift
//  Compendus
//
//  Server connection configuration with UserDefaults persistence
//

import Foundation

@Observable
class ServerConfig {
    private let defaults = UserDefaults.standard
    private let serverURLKey = "serverURL"

    var serverURL: String {
        didSet {
            defaults.set(serverURL, forKey: serverURLKey)
        }
    }

    var isConfigured: Bool {
        !serverURL.isEmpty
    }

    var baseURL: URL? {
        guard !serverURL.isEmpty else { return nil }

        var urlString = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)

        // Add http:// if no scheme provided
        if !urlString.hasPrefix("http://") && !urlString.hasPrefix("https://") {
            urlString = "http://\(urlString)"
        }

        // Remove trailing slash
        if urlString.hasSuffix("/") {
            urlString.removeLast()
        }

        return URL(string: urlString)
    }

    init() {
        self.serverURL = defaults.string(forKey: serverURLKey) ?? ""
    }

    /// Build a URL for an API endpoint
    func apiURL(_ path: String) -> URL? {
        guard let base = baseURL else { return nil }
        let cleanPath = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: "\(base.absoluteString)\(cleanPath)")
    }

    /// Build a URL for a book cover
    func coverURL(for bookId: String) -> URL? {
        apiURL("/covers/\(bookId).jpg")
    }

    /// Build a URL for downloading a book file
    func bookFileURL(for bookId: String, format: String) -> URL? {
        apiURL("/books/\(bookId).\(format)")
    }

    /// Build a URL for a comic page
    func comicPageURL(for bookId: String, format: String, page: Int) -> URL? {
        apiURL("/comic/\(bookId)/\(format)/page/\(page)")
    }

    /// Build a URL for comic info (page count)
    func comicInfoURL(for bookId: String, format: String) -> URL? {
        apiURL("/comic/\(bookId)/\(format)/info")
    }

    /// Test connection to the server
    func testConnection() async -> Bool {
        guard let url = apiURL("/api/books?limit=1") else { return false }

        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse else { return false }
            return (200...299).contains(httpResponse.statusCode)
        } catch {
            return false
        }
    }
}
