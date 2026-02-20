//
//  FloatingHighlightToolbar.swift
//  Compendus
//
//  Floating context menu that appears near selected text.
//  Styled to resemble the native Apple Books highlight menu.
//

import SwiftUI

struct FloatingHighlightToolbar: View {
    let selectionRect: CGRect
    let containerSize: CGSize
    let onSelectColor: (String) -> Void
    let onCustomColor: () -> Void
    let onAddNote: () -> Void
    let onCopy: () -> Void
    let onDismiss: () -> Void

    // Show above selection when there's enough room; otherwise below.
    private var showAbove: Bool {
        selectionRect.minY > 220
    }

    private var toolbarY: CGFloat {
        if showAbove {
            return selectionRect.minY - 10
        } else {
            return selectionRect.maxY + 10
        }
    }

    private var toolbarX: CGFloat {
        let menuWidth: CGFloat = 220
        let half = menuWidth / 2
        let x = selectionRect.midX
        return max(half + 8, min(x, containerSize.width - half - 8))
    }

    var body: some View {
        ZStack {
            // Tap-to-dismiss background
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture { onDismiss() }

            // Context menu
            VStack(spacing: 0) {
                // Color dots row
                HStack(spacing: 12) {
                    ForEach(BookHighlight.colors, id: \.hex) { color in
                        Button {
                            onSelectColor(color.hex)
                        } label: {
                            Circle()
                                .fill(Color(uiColor: UIColor(hex: color.hex) ?? .yellow))
                                .frame(width: 28, height: 28)
                        }
                    }

                    // Custom color picker
                    Button {
                        onCustomColor()
                    } label: {
                        ZStack {
                            Circle()
                                .fill(
                                    AngularGradient(
                                        colors: [.red, .yellow, .green, .cyan, .blue, .purple, .red],
                                        center: .center
                                    )
                                )
                                .frame(width: 28, height: 28)
                            Circle()
                                .fill(.white)
                                .frame(width: 12, height: 12)
                        }
                    }
                }
                .padding(.vertical, 10)
                .padding(.horizontal, 16)

                Divider()

                // Menu items
                menuItem(icon: "note.text", label: "Add Note") {
                    onAddNote()
                }

                Divider()

                menuItem(icon: "doc.on.doc", label: "Copy") {
                    onCopy()
                }
            }
            .frame(width: 220)
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(.regularMaterial)
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(.separator, lineWidth: 0.5)
                    }
                    .shadow(color: .black.opacity(0.15), radius: 16, y: 6)
                    .shadow(color: .black.opacity(0.08), radius: 2, y: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .position(x: toolbarX, y: toolbarY)
        }
    }

    private func menuItem(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 15))
                    .foregroundStyle(.primary)
                    .frame(width: 22)
                Text(label)
                    .font(.system(size: 15))
                    .foregroundStyle(.primary)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
    }
}
