import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";

interface SearchEntry {
  title: string;
  slug: string;
  path: string;
  section: string;
  headings: string[];
  content: string;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [index, setIndex] = useState<SearchEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load search index
  useEffect(() => {
    if (!open || index.length > 0) return;
    fetch(`${import.meta.env.BASE_URL}search-index.json`)
      .then((res) => res.json())
      .then((data: SearchEntry[]) => setIndex(data));
  }, [open, index.length]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Filter results
  useEffect(() => {
    if (!query.trim()) {
      // Show page-level entries when no query
      setResults(index.filter((e) => !e.slug.includes("#")));
      setSelectedIndex(0);
      return;
    }

    const q = query.toLowerCase();
    const scored = index
      .map((entry) => {
        let score = 0;
        const titleLower = entry.title.toLowerCase();
        const contentLower = entry.content.toLowerCase();
        const headingsLower = entry.headings
          .join(" ")
          .toLowerCase();

        if (titleLower === q) score += 100;
        else if (titleLower.startsWith(q)) score += 60;
        else if (titleLower.includes(q)) score += 40;

        if (headingsLower.includes(q)) score += 20;
        if (contentLower.includes(q)) score += 10;

        // Boost page-level entries over section entries
        if (!entry.slug.includes("#")) score += 5;

        return { entry, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.entry);

    setResults(scored.slice(0, 15));
    setSelectedIndex(0);
  }, [query, index]);

  const navigateTo = useCallback(
    (entry: SearchEntry) => {
      onClose();
      navigate(entry.path);
    },
    [navigate, onClose],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            navigateTo(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, navigateTo, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg
            className="w-5 h-5 text-foreground-muted shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation..."
            className="flex-1 bg-transparent text-foreground placeholder:text-foreground-muted outline-none text-sm"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-foreground-muted bg-surface-elevated border border-border rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto py-2"
        >
          {results.length === 0 && query.trim() ? (
            <div className="px-4 py-8 text-center text-foreground-muted text-sm">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((entry, i) => (
              <button
                key={entry.slug}
                onClick={() => navigateTo(entry)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors cursor-pointer ${
                  i === selectedIndex
                    ? "bg-primary-light text-primary"
                    : "text-foreground hover:bg-surface-elevated"
                }`}
              >
                <svg
                  className="w-4 h-4 shrink-0 opacity-50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  {entry.slug.includes("#") ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  )}
                </svg>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {entry.title}
                  </div>
                  <div className="text-xs opacity-60 truncate">
                    {entry.section}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-foreground-muted">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-elevated border border-border rounded font-mono">
              &uarr;
            </kbd>
            <kbd className="px-1 py-0.5 bg-surface-elevated border border-border rounded font-mono">
              &darr;
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-elevated border border-border rounded font-mono">
              &crarr;
            </kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-elevated border border-border rounded font-mono">
              esc
            </kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
