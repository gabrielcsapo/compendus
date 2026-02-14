"use client";

import type { TocEntry, ReaderBookmark, ReaderHighlight } from "@/lib/reader/types";

interface ReaderSidebarProps {
  isOpen: boolean;
  activeTab: "toc" | "bookmarks" | "highlights" | "search";
  onTabChange: (tab: "toc" | "bookmarks" | "highlights" | "search") => void;
  onClose: () => void;
  toc: TocEntry[];
  bookmarks: ReaderBookmark[];
  highlights: ReaderHighlight[];
  currentPosition: number;
  onTocSelect: (position: number) => void;
  onBookmarkSelect: (position: number) => void;
  onBookmarkDelete: (bookmarkId: string) => void;
  onHighlightSelect: (position: number) => void;
  onHighlightDelete: (highlightId: string) => void;
  theme: {
    background: string;
    foreground: string;
    muted: string;
    accent: string;
  };
}

export function ReaderSidebar({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  toc,
  bookmarks,
  highlights,
  currentPosition,
  onTocSelect,
  onBookmarkSelect,
  onBookmarkDelete,
  onHighlightSelect,
  onHighlightDelete,
  theme,
}: ReaderSidebarProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={onClose} />

      {/* Sidebar */}
      <div
        className="fixed md:relative inset-y-0 left-0 w-72 z-50 md:z-auto flex flex-col border-r shadow-lg md:shadow-none"
        style={{
          backgroundColor: theme.background,
          borderColor: `${theme.foreground}20`,
        }}
      >
        {/* Header with tabs */}
        <div className="flex border-b" style={{ borderColor: `${theme.foreground}20` }}>
          <TabButton active={activeTab === "toc"} onClick={() => onTabChange("toc")} theme={theme}>
            Contents
          </TabButton>
          <TabButton
            active={activeTab === "bookmarks"}
            onClick={() => onTabChange("bookmarks")}
            theme={theme}
          >
            Bookmarks ({bookmarks.length})
          </TabButton>
          <TabButton
            active={activeTab === "highlights"}
            onClick={() => onTabChange("highlights")}
            theme={theme}
          >
            Highlights ({highlights.length})
          </TabButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === "toc" && (
            <TocList
              entries={toc}
              currentPosition={currentPosition}
              onSelect={onTocSelect}
              theme={theme}
            />
          )}

          {activeTab === "bookmarks" && (
            <BookmarkList
              bookmarks={bookmarks}
              currentPosition={currentPosition}
              onSelect={onBookmarkSelect}
              onDelete={onBookmarkDelete}
              theme={theme}
            />
          )}

          {activeTab === "highlights" && (
            <HighlightList
              highlights={highlights}
              currentPosition={currentPosition}
              onSelect={onHighlightSelect}
              onDelete={onHighlightDelete}
              theme={theme}
            />
          )}
        </div>

        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="md:hidden absolute top-2 right-2 p-2 rounded-md hover:bg-black/10"
          aria-label="Close sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
  theme,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  theme: ReaderSidebarProps["theme"];
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 px-4 py-3 text-sm font-medium transition-colors"
      style={{
        color: active ? theme.accent : theme.muted,
        borderBottom: active ? `2px solid ${theme.accent}` : "2px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

function TocList({
  entries,
  currentPosition,
  onSelect,
  theme,
  level = 0,
}: {
  entries: TocEntry[];
  currentPosition: number;
  onSelect: (position: number) => void;
  theme: ReaderSidebarProps["theme"];
  level?: number;
}) {
  return (
    <ul className="py-2">
      {entries.map((entry, index) => {
        const isActive =
          entry.position <= currentPosition &&
          (entries[index + 1]?.position > currentPosition || index === entries.length - 1);

        return (
          <li key={`${entry.title}-${index}`}>
            <button
              onClick={() => onSelect(entry.position)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 transition-colors"
              style={{
                paddingLeft: `${16 + level * 16}px`,
                color: isActive ? theme.accent : theme.foreground,
                fontWeight: isActive ? 500 : 400,
              }}
            >
              <span className="line-clamp-2">{entry.title}</span>
              {entry.pageNum && (
                <span className="ml-2 text-xs" style={{ color: theme.muted }}>
                  p. {entry.pageNum}
                </span>
              )}
            </button>
            {entry.children && entry.children.length > 0 && (
              <TocList
                entries={entry.children}
                currentPosition={currentPosition}
                onSelect={onSelect}
                theme={theme}
                level={level + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function BookmarkList({
  bookmarks,
  currentPosition,
  onSelect,
  onDelete,
  theme,
}: {
  bookmarks: ReaderBookmark[];
  currentPosition: number;
  onSelect: (position: number) => void;
  onDelete: (id: string) => void;
  theme: ReaderSidebarProps["theme"];
}) {
  if (bookmarks.length === 0) {
    return (
      <div className="p-4 text-center text-sm" style={{ color: theme.muted }}>
        No bookmarks yet
      </div>
    );
  }

  // Sort bookmarks by position
  const sortedBookmarks = [...bookmarks].sort((a, b) => a.position - b.position);

  return (
    <ul className="py-2">
      {sortedBookmarks.map((bookmark) => {
        const isActive = Math.abs(bookmark.position - currentPosition) < 0.001;

        return (
          <li key={bookmark.id} className="group relative">
            <button
              onClick={() => onSelect(bookmark.position)}
              className="w-full text-left px-4 py-3 pr-12 hover:bg-black/5 transition-colors"
              style={{
                color: isActive ? theme.accent : theme.foreground,
              }}
            >
              <div className="text-sm font-medium line-clamp-1">
                {bookmark.title || `Position ${(bookmark.position * 100).toFixed(1)}%`}
              </div>
              {bookmark.note && (
                <div className="text-xs line-clamp-2 mt-1" style={{ color: theme.muted }}>
                  {bookmark.note}
                </div>
              )}
              <div className="text-xs mt-1" style={{ color: theme.muted }}>
                {(bookmark.position * 100).toFixed(1)}% through book
              </div>
            </button>

            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(bookmark.id);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-500 transition-opacity"
              aria-label="Delete bookmark"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function HighlightList({
  highlights,
  currentPosition,
  onSelect,
  onDelete,
  theme,
}: {
  highlights: ReaderHighlight[];
  currentPosition: number;
  onSelect: (position: number) => void;
  onDelete: (id: string) => void;
  theme: ReaderSidebarProps["theme"];
}) {
  if (highlights.length === 0) {
    return (
      <div className="p-4 text-center text-sm" style={{ color: theme.muted }}>
        No highlights yet. Select text while reading to highlight.
      </div>
    );
  }

  const sortedHighlights = [...highlights].sort((a, b) => a.startPosition - b.startPosition);

  return (
    <ul className="py-2">
      {sortedHighlights.map((highlight) => {
        const isNearCurrent =
          highlight.startPosition <= currentPosition &&
          highlight.endPosition >= currentPosition;

        return (
          <li key={highlight.id} className="group relative">
            <button
              onClick={() => onSelect(highlight.startPosition)}
              className="w-full text-left px-4 py-3 pr-12 hover:bg-black/5 transition-colors"
              style={{ color: isNearCurrent ? theme.accent : theme.foreground }}
            >
              {/* Color indicator bar */}
              <div
                className="absolute left-0 top-2 bottom-2 w-1 rounded-r"
                style={{ backgroundColor: highlight.color }}
              />

              {/* Highlighted text preview */}
              <div className="text-sm line-clamp-3 pl-2 italic">
                &ldquo;{highlight.text}&rdquo;
              </div>

              {/* Note if present */}
              {highlight.note && (
                <div className="text-xs line-clamp-2 mt-1 pl-2" style={{ color: theme.muted }}>
                  {highlight.note}
                </div>
              )}

              {/* Position info */}
              <div className="text-xs mt-1 pl-2" style={{ color: theme.muted }}>
                {(highlight.startPosition * 100).toFixed(1)}% through book
              </div>
            </button>

            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(highlight.id);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-500 transition-opacity"
              aria-label="Delete highlight"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
