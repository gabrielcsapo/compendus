//
//  StorageRingChart.swift
//  Compendus
//
//  Ring chart showing storage breakdown by format
//

import SwiftUI
import Charts

/// Storage breakdown data for the ring chart
struct StorageSegment: Identifiable {
    let id = UUID()
    let category: String
    let bytes: Int64
    let color: Color

    var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file)
    }
}

/// A ring chart showing storage usage by category
struct StorageRingChart: View {
    let segments: [StorageSegment]
    let availableBytes: Int64

    private var totalUsed: Int64 {
        segments.reduce(0) { $0 + $1.bytes }
    }

    private var totalCapacity: Int64 {
        totalUsed + availableBytes
    }

    var body: some View {
        VStack(spacing: 16) {
            // Ring chart with total in center
            ZStack {
                // Chart
                Chart(segments) { segment in
                    SectorMark(
                        angle: .value("Size", segment.bytes),
                        innerRadius: .ratio(0.6),
                        angularInset: 1.5
                    )
                    .foregroundStyle(segment.color)
                    .cornerRadius(4)
                }
                .chartLegend(.hidden)
                .frame(width: 150, height: 150)

                // Center text
                VStack(spacing: 2) {
                    Text(ByteCountFormatter.string(fromByteCount: totalUsed, countStyle: .file))
                        .font(.title3)
                        .fontWeight(.bold)

                    Text("Used")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            // Legend
            VStack(alignment: .leading, spacing: 8) {
                ForEach(segments) { segment in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(segment.color)
                            .frame(width: 10, height: 10)

                        Text(segment.category)
                            .font(.subheadline)

                        Spacer()

                        Text(segment.formattedSize)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                Divider()

                HStack {
                    Text("Available")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Spacer()

                    Text(ByteCountFormatter.string(fromByteCount: availableBytes, countStyle: .file))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityDescription)
    }

    private var accessibilityDescription: String {
        var description = "Storage breakdown. "
        for segment in segments {
            description += "\(segment.category): \(segment.formattedSize). "
        }
        description += "Available: \(ByteCountFormatter.string(fromByteCount: availableBytes, countStyle: .file))."
        return description
    }
}

/// A simpler bar-style storage visualization
struct StorageBarChart: View {
    let segments: [StorageSegment]
    let availableBytes: Int64

    private var totalUsed: Int64 {
        segments.reduce(0) { $0 + $1.bytes }
    }

    private var totalCapacity: Int64 {
        totalUsed + availableBytes
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Stacked bar
            GeometryReader { geometry in
                HStack(spacing: 2) {
                    ForEach(segments) { segment in
                        let width = totalCapacity > 0
                            ? geometry.size.width * CGFloat(segment.bytes) / CGFloat(totalCapacity)
                            : 0

                        RoundedRectangle(cornerRadius: 4)
                            .fill(segment.color)
                            .frame(width: max(4, width))
                    }

                    // Available space
                    let availableWidth = totalCapacity > 0
                        ? geometry.size.width * CGFloat(availableBytes) / CGFloat(totalCapacity)
                        : geometry.size.width

                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.2))
                        .frame(width: max(4, availableWidth))
                }
            }
            .frame(height: 12)

            // Legend
            HStack(spacing: 16) {
                ForEach(segments) { segment in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(segment.color)
                            .frame(width: 8, height: 8)

                        Text(segment.category)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Summary
            HStack {
                Text("\(ByteCountFormatter.string(fromByteCount: totalUsed, countStyle: .file)) used")
                    .font(.caption)

                Spacer()

                Text("\(ByteCountFormatter.string(fromByteCount: availableBytes, countStyle: .file)) available")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

#Preview("Ring Chart") {
    StorageRingChart(
        segments: [
            StorageSegment(category: "Ebooks", bytes: 500_000_000, color: .blue),
            StorageSegment(category: "Audiobooks", bytes: 2_000_000_000, color: .green),
            StorageSegment(category: "Comics", bytes: 300_000_000, color: .purple),
            StorageSegment(category: "Cache", bytes: 100_000_000, color: .gray)
        ],
        availableBytes: 50_000_000_000
    )
    .padding()
}

#Preview("Bar Chart") {
    StorageBarChart(
        segments: [
            StorageSegment(category: "Ebooks", bytes: 500_000_000, color: .blue),
            StorageSegment(category: "Audiobooks", bytes: 2_000_000_000, color: .green),
            StorageSegment(category: "Comics", bytes: 300_000_000, color: .purple)
        ],
        availableBytes: 50_000_000_000
    )
    .padding()
}
