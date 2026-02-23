//
//  AppDelegate.swift
//  Compendus
//
//  Handles background URL session events for downloads that complete
//  while the app is suspended or terminated.
//

import UIKit

class AppDelegate: NSObject, UIApplicationDelegate {
    /// Stored by iOS when background download events are ready.
    /// Must be called after DownloadManager processes all pending events.
    var backgroundSessionCompletionHandler: (() -> Void)?

    func application(
        _ application: UIApplication,
        handleEventsForBackgroundURLSession identifier: String,
        completionHandler: @escaping () -> Void
    ) {
        print("[AppDelegate] Background session events for: \(identifier)")
        backgroundSessionCompletionHandler = completionHandler
    }
}
