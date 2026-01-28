"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useViewport } from "./useViewport";
import { useReaderSettings } from "./useReaderSettings";
import type {
  ReaderInfoResponse,
  PageContent,
  ReaderBookmark,
  ReaderHighlight,
} from "@/lib/reader/types";

export interface UseReaderOptions {
  bookId: string;
  initialPosition?: number;
}

export interface UseReaderReturn {
  // Book info
  bookInfo: ReaderInfoResponse | null;
  loading: boolean;
  error: string | null;

  // Current page
  currentPage: number;
  totalPages: number;
  pageContent: PageContent | null;
  rightPageContent: PageContent | null; // Second page for spread view
  position: number;
  isSpreadMode: boolean;

  // Navigation
  goToPage: (page: number) => void;
  goToPosition: (position: number) => Promise<void>;
  nextPage: () => void;
  prevPage: () => void;

  // Settings
  settings: ReturnType<typeof useReaderSettings>["settings"];
  updateGlobalSetting: ReturnType<typeof useReaderSettings>["updateGlobalSetting"];
  updateBookSetting: ReturnType<typeof useReaderSettings>["updateBookSetting"];

  // Viewport
  viewport: ReturnType<typeof useViewport>;

  // Bookmarks & Highlights
  bookmarks: ReaderBookmark[];
  highlights: ReaderHighlight[];
  addBookmark: (position: number, title?: string, note?: string) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  addHighlight: (
    startPosition: number,
    endPosition: number,
    text: string,
    note?: string,
    color?: string,
  ) => Promise<void>;
  removeHighlight: (highlightId: string) => Promise<void>;

  // Progress
  saveProgress: () => Promise<void>;
}

/**
 * Main hook for the unified reader
 */
export function useReader({ bookId, initialPosition = 0 }: UseReaderOptions): UseReaderReturn {
  const viewport = useViewport();
  const {
    settings,
    updateGlobalSetting,
    updateBookSetting,
  } = useReaderSettings(bookId);

  // State
  const [bookInfo, setBookInfo] = useState<ReaderInfoResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [rightPageContent, setRightPageContent] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>([]);
  const [highlights, setHighlights] = useState<ReaderHighlight[]>([]);

  // Determine if we should show spread mode based on settings and viewport
  // Spread mode only applies to image content (PDF, comics)
  const isSpreadMode = (() => {
    const layout = settings.pdfPageLayout;
    if (layout === "single") return false;
    if (layout === "spread") return true;
    // Auto: use spread on wide viewports (desktop)
    return viewport.width >= 1024;
  })();

  // Track if initial position has been applied
  const initialPositionApplied = useRef(false);

  // Track prefetched pages to avoid duplicate requests
  const prefetchedPages = useRef(new Set<number>());

  // Number of pages to prefetch ahead
  const PREFETCH_AHEAD = 5;

  // Build query string for viewport
  const viewportQuery = `width=${viewport.width}&height=${viewport.height}&fontSize=${settings.fontSize}&lineHeight=${settings.lineHeight}`;

  // Reset prefetch cache when book changes
  useEffect(() => {
    prefetchedPages.current.clear();
  }, [bookId]);

  // Fetch book info when viewport changes
  useEffect(() => {
    if (viewport.width === 0 || viewport.height === 0) return;

    const fetchInfo = async () => {
      try {
        const res = await fetch(`/api/reader/${bookId}/info?${viewportQuery}`);
        const data = await res.json();

        if (data.success) {
          setBookInfo(data);
          setError(null);

          // Apply initial position if not yet applied
          if (!initialPositionApplied.current && initialPosition > 0) {
            initialPositionApplied.current = true;
            const posRes = await fetch(
              `/api/reader/${bookId}/position/${initialPosition}?${viewportQuery}`,
            );
            const posData = await posRes.json();
            if (posData.success) {
              setCurrentPage(posData.pageNum);
            }
          }
        } else {
          setError(data.error || "Failed to load book");
        }
      } catch (err) {
        setError("Failed to connect to server");
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [bookId, viewportQuery, initialPosition]);

  // Fetch page content when page changes
  useEffect(() => {
    if (!bookInfo || viewport.width === 0) return;

    const fetchPages = async () => {
      try {
        // Fetch the left (or only) page
        const res = await fetch(`/api/reader/${bookId}/page/${currentPage}?${viewportQuery}`);
        const data = await res.json();

        if (data.success) {
          setPageContent(data.content);

          // In spread mode, also fetch the right page if available
          if (isSpreadMode && data.content?.type === "image" && currentPage < bookInfo.totalPages) {
            const rightRes = await fetch(`/api/reader/${bookId}/page/${currentPage + 1}?${viewportQuery}`);
            const rightData = await rightRes.json();
            if (rightData.success) {
              setRightPageContent(rightData.content);
            } else {
              setRightPageContent(null);
            }
          } else {
            setRightPageContent(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch page:", err);
      }
    };

    fetchPages();
  }, [bookId, currentPage, viewportQuery, bookInfo, isSpreadMode]);

  // Prefetch upcoming pages in the background
  useEffect(() => {
    if (!bookInfo || viewport.width === 0) return;

    const prefetchPages = async () => {
      const totalPages = bookInfo.totalPages;

      for (let i = 1; i <= PREFETCH_AHEAD; i++) {
        const pageNum = currentPage + i;

        // Skip if beyond total pages or already prefetched
        if (pageNum > totalPages || prefetchedPages.current.has(pageNum)) {
          continue;
        }

        // Mark as prefetched before starting
        prefetchedPages.current.add(pageNum);

        // Fetch page data (this triggers server-side rendering for PDFs)
        fetch(`/api/reader/${bookId}/page/${pageNum}?${viewportQuery}`)
          .then((res) => res.json())
          .then((data) => {
            // For image content (PDFs, comics), also prefetch the image
            if (data.success && data.content?.imageUrl) {
              const img = new Image();
              img.src = data.content.imageUrl;
            }
          })
          .catch(() => {
            // Remove from prefetched so it can be retried
            prefetchedPages.current.delete(pageNum);
          });
      }
    };

    // Small delay to prioritize current page load
    const timer = setTimeout(prefetchPages, 100);
    return () => clearTimeout(timer);
  }, [bookId, currentPage, viewportQuery, bookInfo]);

  // Fetch bookmarks and highlights
  useEffect(() => {
    const fetchAnnotations = async () => {
      try {
        const [bookmarksRes, highlightsRes] = await Promise.all([
          fetch(`/api/reader/${bookId}/bookmarks`),
          fetch(`/api/reader/${bookId}/highlights`),
        ]);

        const bookmarksData = await bookmarksRes.json();
        const highlightsData = await highlightsRes.json();

        if (bookmarksData.success) {
          setBookmarks(bookmarksData.bookmarks);
        }
        if (highlightsData.success) {
          setHighlights(highlightsData.highlights);
        }
      } catch (err) {
        console.error("Failed to fetch annotations:", err);
      }
    };

    fetchAnnotations();
  }, [bookId]);

  // Navigation functions
  const goToPage = useCallback(
    (page: number) => {
      if (!bookInfo) return;
      const clampedPage = Math.max(1, Math.min(page, bookInfo.totalPages));
      setCurrentPage(clampedPage);
    },
    [bookInfo],
  );

  const goToPosition = useCallback(
    async (position: number) => {
      try {
        const res = await fetch(`/api/reader/${bookId}/position/${position}?${viewportQuery}`);
        const data = await res.json();

        if (data.success) {
          setCurrentPage(data.pageNum);
          setPageContent(data.content);
        }
      } catch (err) {
        console.error("Failed to go to position:", err);
      }
    },
    [bookId, viewportQuery],
  );

  // In spread mode with image content, move by 2 pages
  const pageStep = isSpreadMode && pageContent?.type === "image" ? 2 : 1;

  const nextPage = useCallback(() => {
    goToPage(currentPage + pageStep);
  }, [currentPage, goToPage, pageStep]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - pageStep);
  }, [currentPage, goToPage, pageStep]);

  // Bookmark functions
  const addBookmark = useCallback(
    async (position: number, title?: string, note?: string) => {
      try {
        const res = await fetch(`/api/reader/${bookId}/bookmark`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position, title, note }),
        });
        const data = await res.json();

        if (data.success) {
          setBookmarks((prev) => [...prev, data.bookmark]);
        }
      } catch (err) {
        console.error("Failed to add bookmark:", err);
      }
    },
    [bookId],
  );

  const removeBookmark = useCallback(
    async (bookmarkId: string) => {
      try {
        const res = await fetch(`/api/reader/${bookId}/bookmark/${bookmarkId}`, {
          method: "DELETE",
        });
        const data = await res.json();

        if (data.success) {
          setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
        }
      } catch (err) {
        console.error("Failed to remove bookmark:", err);
      }
    },
    [bookId],
  );

  // Highlight functions
  const addHighlight = useCallback(
    async (
      startPosition: number,
      endPosition: number,
      text: string,
      note?: string,
      color?: string,
    ) => {
      try {
        const res = await fetch(`/api/reader/${bookId}/highlight`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startPosition, endPosition, text, note, color }),
        });
        const data = await res.json();

        if (data.success) {
          setHighlights((prev) => [...prev, data.highlight]);
        }
      } catch (err) {
        console.error("Failed to add highlight:", err);
      }
    },
    [bookId],
  );

  const removeHighlight = useCallback(
    async (highlightId: string) => {
      try {
        const res = await fetch(`/api/reader/${bookId}/highlight/${highlightId}`, {
          method: "DELETE",
        });
        const data = await res.json();

        if (data.success) {
          setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
        }
      } catch (err) {
        console.error("Failed to remove highlight:", err);
      }
    },
    [bookId],
  );

  // Save progress
  const saveProgress = useCallback(async () => {
    if (!pageContent) return;

    try {
      await fetch(`/api/reader/${bookId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: pageContent.position,
          pageNum: currentPage,
        }),
      });
    } catch (err) {
      console.error("Failed to save progress:", err);
    }
  }, [bookId, currentPage, pageContent]);

  // Auto-save progress when page changes
  useEffect(() => {
    if (!pageContent) return;

    const timer = setTimeout(() => {
      saveProgress();
    }, 2000); // Debounce 2 seconds

    return () => clearTimeout(timer);
  }, [currentPage, pageContent, saveProgress]);

  return {
    bookInfo,
    loading,
    error,
    currentPage,
    totalPages: bookInfo?.totalPages || 0,
    pageContent,
    rightPageContent,
    position: pageContent?.position || 0,
    isSpreadMode,
    goToPage,
    goToPosition,
    nextPage,
    prevPage,
    settings,
    updateGlobalSetting,
    updateBookSetting,
    viewport,
    bookmarks,
    highlights,
    addBookmark,
    removeBookmark,
    addHighlight,
    removeHighlight,
    saveProgress,
  };
}
