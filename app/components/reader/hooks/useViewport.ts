"use client";

import { useState, useEffect, useRef, type RefObject } from "react";

export interface Viewport {
  width: number;
  height: number;
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Hook to track viewport dimensions of a container element
 */
export function useViewport(): Viewport {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 1200 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial measurement
    const rect = container.getBoundingClientRect();
    setViewport({
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });

    // Observe size changes
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setViewport({
          width: Math.round(width),
          height: Math.round(height),
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return { ...viewport, containerRef };
}
