"use client";

import { useEffect, useRef } from "react";

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#ffff00" },
  { name: "Green", value: "#00ff00" },
  { name: "Blue", value: "#00bfff" },
  { name: "Pink", value: "#ff69b4" },
  { name: "Orange", value: "#ffa500" },
];

interface HighlightToolbarProps {
  position: { x: number; y: number; above: boolean };
  onHighlight: (color: string) => void;
  onDismiss: () => void;
  theme: {
    background: string;
    foreground: string;
    muted: string;
  };
}

export function HighlightToolbar({
  position,
  onHighlight,
  onDismiss,
  theme,
}: HighlightToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside click or scroll
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };

    const handleScroll = () => {
      onDismiss();
    };

    // Delay attaching to avoid immediately dismissing from the same event
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
      document.addEventListener("scroll", handleScroll, true);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [onDismiss]);

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        backgroundColor: theme.background,
        borderColor: `${theme.foreground}20`,
      }}
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
    >
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color.value}
          onClick={(e) => {
            e.stopPropagation();
            onHighlight(color.value);
          }}
          className="w-7 h-7 rounded-full border-2 border-transparent hover:border-current hover:scale-110 transition-all"
          style={{ backgroundColor: color.value }}
          aria-label={`Highlight ${color.name}`}
          title={color.name}
        />
      ))}
    </div>
  );
}
