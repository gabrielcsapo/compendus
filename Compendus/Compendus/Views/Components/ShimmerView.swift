//
//  ShimmerView.swift
//  Compendus
//
//  Skeleton loading with shimmer animation effect
//

import SwiftUI

/// A shimmer effect modifier for skeleton loading states
struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    LinearGradient(
                        gradient: Gradient(colors: [
                            .clear,
                            Color.white.opacity(0.4),
                            .clear
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geometry.size.width * 2)
                    .offset(x: -geometry.size.width + (geometry.size.width * 2 * phase))
                }
                .mask(content)
            )
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(
                    .linear(duration: 1.5)
                    .repeatForever(autoreverses: false)
                ) {
                    phase = 1
                }
            }
    }
}

extension View {
    /// Apply a shimmer effect to the view
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

/// A skeleton placeholder for book grid items during loading
struct SkeletonBookGridItem: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Cover placeholder
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.gray.opacity(0.2))
                .frame(height: 200)
                .shimmer()

            // Title placeholder
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.gray.opacity(0.2))
                .frame(height: 16)
                .shimmer()

            // Author placeholder
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.gray.opacity(0.2))
                .frame(width: 100, height: 12)
                .shimmer()

            // Badge placeholder
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.gray.opacity(0.2))
                .frame(width: 50, height: 18)
                .shimmer()
        }
    }
}

/// A grid of skeleton items for loading states
struct SkeletonBookGrid: View {
    let count: Int

    private let columns = [
        GridItem(.adaptive(minimum: 150, maximum: 200), spacing: 12)
    ]

    init(count: Int = 8) {
        self.count = count
    }

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(0..<count, id: \.self) { _ in
                    SkeletonBookGridItem()
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 20)
        }
    }
}

/// A simple shimmer rectangle for inline loading states
struct ShimmerRectangle: View {
    let cornerRadius: CGFloat

    init(cornerRadius: CGFloat = 8) {
        self.cornerRadius = cornerRadius
    }

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Color.gray.opacity(0.2))
            .shimmer()
    }
}

#Preview("Skeleton Grid Item") {
    SkeletonBookGridItem()
        .frame(width: 180)
        .padding()
}

#Preview("Skeleton Grid") {
    SkeletonBookGrid(count: 6)
}
