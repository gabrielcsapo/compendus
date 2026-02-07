//
//  TapZoneOverlay.swift
//  Compendus
//
//  First-time tutorial overlay showing tap zones for comic reader
//

import SwiftUI

/// An overlay that shows tap zones for the comic reader
struct TapZoneOverlay: View {
    @Binding var isShowing: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            // Semi-transparent background
            Color.black.opacity(0.8)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Text("Tap to Navigate")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)

                // Tap zone diagram
                HStack(spacing: 0) {
                    // Left zone - Previous
                    ZStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.blue.opacity(0.3))
                            .stroke(Color.blue, lineWidth: 2)

                        VStack(spacing: 8) {
                            Image(systemName: "chevron.left")
                                .font(.title)
                            Text("Previous")
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                        .foregroundStyle(.white)
                    }
                    .frame(width: 80, height: 120)

                    // Center zone - Controls
                    ZStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.gray.opacity(0.3))
                            .stroke(Color.gray, lineWidth: 2)

                        VStack(spacing: 8) {
                            Image(systemName: "slider.horizontal.3")
                                .font(.title)
                            Text("Controls")
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                        .foregroundStyle(.white)
                    }
                    .frame(width: 100, height: 120)

                    // Right zone - Next
                    ZStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.green.opacity(0.3))
                            .stroke(Color.green, lineWidth: 2)

                        VStack(spacing: 8) {
                            Image(systemName: "chevron.right")
                                .font(.title)
                            Text("Next")
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                        .foregroundStyle(.white)
                    }
                    .frame(width: 80, height: 120)
                }
                .padding(.vertical, 16)

                // Swipe gesture hint
                HStack(spacing: 24) {
                    HStack(spacing: 8) {
                        Image(systemName: "hand.draw")
                        Text("Swipe left/right")
                    }
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.8))

                    HStack(spacing: 8) {
                        Image(systemName: "hand.pinch")
                        Text("Pinch to zoom")
                    }
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.8))
                }

                Button {
                    withAnimation(reduceMotion ? .none : .easeOut(duration: 0.2)) {
                        isShowing = false
                    }
                    // Save that we've shown the tutorial
                    UserDefaults.standard.set(true, forKey: "hasSeenComicTutorial")
                } label: {
                    Text("Got it!")
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 32)
                        .padding(.vertical, 12)
                        .background(Color.accentColor)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .padding(.top, 8)
            }
            .padding(32)
        }
        .onTapGesture {
            withAnimation(reduceMotion ? .none : .easeOut(duration: 0.2)) {
                isShowing = false
            }
            UserDefaults.standard.set(true, forKey: "hasSeenComicTutorial")
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Comic reader tutorial. Tap left side for previous page, center for controls, right side for next page. Swipe left or right to navigate. Pinch to zoom. Tap anywhere to dismiss.")
        .accessibilityAddTraits(.isModal)
    }

    /// Check if the tutorial should be shown
    static var shouldShow: Bool {
        !UserDefaults.standard.bool(forKey: "hasSeenComicTutorial")
    }

    /// Reset the tutorial (for testing)
    static func reset() {
        UserDefaults.standard.removeObject(forKey: "hasSeenComicTutorial")
    }
}

#Preview {
    TapZoneOverlay(isShowing: .constant(true))
}
