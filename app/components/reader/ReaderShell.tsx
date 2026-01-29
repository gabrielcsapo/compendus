"use client";

import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useReader } from "./hooks/useReader";
import { ReaderContent } from "./ReaderContent";
import { ReaderToolbar } from "./ReaderToolbar";
import { ReaderSidebar } from "./ReaderSidebar";
import { ReaderSettings } from "./ReaderSettings";
import { THEMES } from "@/lib/reader/settings";

interface ReaderShellProps {
  bookId: string;
  initialPosition?: number;
  returnUrl?: string;
}

/**
 * Main reader shell that orchestrates all reader components
 */
export function ReaderShell({ bookId, initialPosition = 0, returnUrl = "/" }: ReaderShellProps) {
  const navigate = useNavigate();

  const handleClose = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);
  const reader = useReader({ bookId, initialPosition });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"toc" | "bookmarks" | "search">("toc");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const theme = THEMES[reader.settings.theme];

  // Handle TOC navigation
  const handleTocSelect = useCallback(
    (position: number) => {
      reader.goToPosition(position);
      setSidebarOpen(false);
    },
    [reader],
  );

  // Handle bookmark navigation
  const handleBookmarkSelect = useCallback(
    (position: number) => {
      reader.goToPosition(position);
      setSidebarOpen(false);
    },
    [reader],
  );

  // Add bookmark at current position
  const handleAddBookmark = useCallback(() => {
    if (reader.pageContent) {
      const title = reader.pageContent.chapterTitle || `Page ${reader.currentPage}`;
      reader.addBookmark(reader.pageContent.position, title);
    }
  }, [reader]);

  // Toggle sidebar
  const toggleSidebar = useCallback((tab?: "toc" | "bookmarks" | "search") => {
    if (tab) {
      setSidebarTab(tab);
      setSidebarOpen(true);
    } else {
      setSidebarOpen((prev) => !prev);
    }
  }, []);

  // Loading state
  if (reader.loading) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: theme.background, color: theme.foreground }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-current mx-auto mb-4" />
          <p>Loading book...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (reader.error) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: theme.background, color: theme.foreground }}
      >
        <div className="text-center">
          <p className="text-red-500 mb-4">Error: {reader.error}</p>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col"
      style={{ backgroundColor: theme.background, color: theme.foreground }}
    >
      {/* Toolbar */}
      <ReaderToolbar
        title={reader.bookInfo?.title || ""}
        currentPage={reader.currentPage}
        totalPages={reader.totalPages}
        onGoToPage={reader.goToPage}
        onClose={handleClose}
        onToggleSidebar={() => toggleSidebar()}
        onToggleSettings={() => setSettingsOpen((prev) => !prev)}
        onAddBookmark={handleAddBookmark}
        hasBookmark={reader.bookmarks.some((b) => Math.abs(b.position - reader.position) < 0.001)}
        theme={theme}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <ReaderSidebar
          isOpen={sidebarOpen}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          onClose={() => setSidebarOpen(false)}
          toc={reader.bookInfo?.toc || []}
          bookmarks={reader.bookmarks}
          currentPosition={reader.position}
          onTocSelect={handleTocSelect}
          onBookmarkSelect={handleBookmarkSelect}
          onBookmarkDelete={reader.removeBookmark}
          theme={theme}
        />

        {/* Content area with viewport measurement */}
        <div ref={reader.viewport.containerRef} className="flex-1 relative">
          <ReaderContent
            content={reader.pageContent}
            rightContent={reader.rightPageContent}
            settings={reader.settings}
            isSpreadMode={reader.isSpreadMode}
            onPrevPage={reader.prevPage}
            onNextPage={reader.nextPage}
            audioChapters={reader.bookInfo?.chapters}
            audioDuration={reader.bookInfo?.duration}
          />
        </div>

        {/* Settings panel */}
        <ReaderSettings
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={reader.settings}
          onUpdateSetting={reader.updateGlobalSetting}
          theme={theme}
        />
      </div>

      {/* Footer with progress */}
      <div className="h-1 bg-black/10" style={{ backgroundColor: `${theme.foreground}10` }}>
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${reader.position * 100}%`,
            backgroundColor: theme.accent,
          }}
        />
      </div>
    </div>
  );
}
