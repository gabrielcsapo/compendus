//
//  LazyImageAttachment.swift
//  Compendus
//
//  NSTextAttachment subclass that stores image URL and dimensions but does NOT
//  load pixel data until explicitly asked. Used during pagination so CTFramesetter
//  computes correct page breaks without decoding full images. Actual pixel data
//  is loaded at render time via loadImageIfNeeded().
//

import UIKit

final class LazyImageAttachment: NSTextAttachment {
    /// File URL of the image on disk (extracted EPUB temp directory).
    let imageURL: URL

    /// Intrinsic pixel dimensions read from the image header.
    let intrinsicSize: CGSize

    /// Thread-safety lock for lazy image loading.
    private let lock = NSLock()

    /// Whether the actual UIImage has been loaded into `self.image`.
    var isLoaded: Bool { image != nil }

    init(imageURL: URL, intrinsicSize: CGSize, displayBounds: CGRect) {
        self.imageURL = imageURL
        self.intrinsicSize = intrinsicSize
        super.init(data: nil, ofType: nil)
        self.bounds = displayBounds
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not supported")
    }

    /// Load the actual UIImage from cache or disk. Thread-safe.
    /// Call this at render time, not pagination time.
    func loadImageIfNeeded() {
        lock.lock()
        defer { lock.unlock() }
        guard image == nil else { return }

        if let cached = EPUBImageCache.shared.image(forPath: imageURL.path) {
            image = cached
        } else if let loaded = UIImage(contentsOfFile: imageURL.path) {
            EPUBImageCache.shared.setImage(loaded, forPath: imageURL.path)
            image = loaded
        }
    }

    /// Asynchronously load the image off the main thread. Returns true if the image
    /// was loaded (or was already loaded). Callers on the main thread should use this
    /// to avoid blocking the UI during disk I/O and image decoding.
    func loadImageAsync() async -> Bool {
        // Fast path: already loaded
        lock.lock()
        if image != nil { lock.unlock(); return true }
        lock.unlock()

        let url = imageURL
        let loaded: UIImage? = await Task.detached(priority: .userInitiated) {
            if let cached = EPUBImageCache.shared.image(forPath: url.path) {
                return cached
            } else if let img = UIImage(contentsOfFile: url.path) {
                EPUBImageCache.shared.setImage(img, forPath: url.path)
                return img
            }
            return nil
        }.value

        guard let loaded else { return false }
        lock.lock()
        if image == nil { image = loaded }
        lock.unlock()
        return true
    }
}
