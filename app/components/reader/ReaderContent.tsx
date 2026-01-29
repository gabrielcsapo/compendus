"use client";

import { useEffect, useRef, useState } from "react";
import type { PageContent } from "@/lib/reader/types";
import type { ReaderSettings } from "@/lib/reader/settings";
import { THEMES, FONTS } from "@/lib/reader/settings";
import type { AudioChapter } from "@/lib/types";

interface ReaderContentProps {
  content: PageContent | null;
  rightContent?: PageContent | null; // Second page for spread view
  settings: ReaderSettings;
  isSpreadMode?: boolean;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  // Audio-specific props
  audioChapters?: AudioChapter[];
  audioDuration?: number;
}

/**
 * Renders page content based on type (text, image, audio)
 */
export function ReaderContent({
  content,
  rightContent,
  settings,
  isSpreadMode,
  onPrevPage,
  onNextPage,
  audioChapters,
  audioDuration,
}: ReaderContentProps) {
  if (!content) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  switch (content.type) {
    case "text":
      return (
        <TextContent
          content={content}
          settings={settings}
          onPrevPage={onPrevPage}
          onNextPage={onNextPage}
        />
      );
    case "image":
      return (
        <ImageContent
          content={content}
          rightContent={rightContent}
          settings={settings}
          isSpreadMode={isSpreadMode}
          onPrevPage={onPrevPage}
          onNextPage={onNextPage}
        />
      );
    case "audio":
      return (
        <AudioContent
          content={content}
          settings={settings}
          chapters={audioChapters}
          totalDuration={audioDuration}
        />
      );
    default:
      return <div>Unsupported content type</div>;
  }
}

/**
 * Text content renderer (EPUB, MOBI)
 */
function TextContent({
  content,
  settings,
  onPrevPage,
  onNextPage,
}: {
  content: PageContent;
  settings: ReaderSettings;
  onPrevPage?: () => void;
  onNextPage?: () => void;
}) {
  const theme = THEMES[settings.theme];
  const font = FONTS[settings.fontFamily];

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        onNextPage?.();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        onPrevPage?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPrevPage, onNextPage]);

  return (
    <div
      className="h-full overflow-auto p-4 md:p-8 relative"
      style={{
        backgroundColor: theme.background,
        color: theme.foreground,
      }}
    >
      <div
        className="mx-auto prose max-w-none"
        style={
          {
            maxWidth: `${settings.maxWidth}px`,
            fontFamily: font.value,
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            textAlign: settings.textAlign,
            padding: `0 ${settings.margins}%`,
            // Override Tailwind prose colors with theme colors
            "--tw-prose-body": theme.foreground,
            "--tw-prose-headings": theme.foreground,
            "--tw-prose-lead": theme.foreground,
            "--tw-prose-links": theme.accent,
            "--tw-prose-bold": theme.foreground,
            "--tw-prose-counters": theme.muted,
            "--tw-prose-bullets": theme.muted,
            "--tw-prose-hr": theme.muted,
            "--tw-prose-quotes": theme.foreground,
            "--tw-prose-quote-borders": theme.muted,
            "--tw-prose-captions": theme.muted,
            "--tw-prose-code": theme.foreground,
            "--tw-prose-pre-code": theme.foreground,
            "--tw-prose-pre-bg": theme.background,
            "--tw-prose-th-borders": theme.muted,
            "--tw-prose-td-borders": theme.muted,
          } as React.CSSProperties
        }
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized server-side
        dangerouslySetInnerHTML={{ __html: content.html || "" }}
      />

      {/* Click zones for navigation - absolute within content area so they don't overlap toolbar */}
      <div
        className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize opacity-0 hover:opacity-10 hover:bg-black/5 transition-opacity z-10"
        onClick={onPrevPage}
        aria-label="Previous page"
      />
      <div
        className="absolute inset-y-0 right-0 w-1/4 cursor-e-resize opacity-0 hover:opacity-10 hover:bg-black/5 transition-opacity z-10"
        onClick={onNextPage}
        aria-label="Next page"
      />
    </div>
  );
}

/**
 * Loading placeholder for images
 */
function ImageLoadingPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground animate-pulse">Loading...</span>
      </div>
    </div>
  );
}

/**
 * Image content renderer (PDF pages, Comics)
 * Supports single page and two-page spread modes
 */
function ImageContent({
  content,
  rightContent,
  settings,
  isSpreadMode,
  onPrevPage,
  onNextPage,
}: {
  content: PageContent;
  rightContent?: PageContent | null;
  settings: ReaderSettings;
  isSpreadMode?: boolean;
  onPrevPage?: () => void;
  onNextPage?: () => void;
}) {
  const theme = THEMES[settings.theme];
  const showSpread = isSpreadMode && rightContent?.imageUrl;

  // Refs to check if images are already cached
  const leftImgRef = useRef<HTMLImageElement>(null);
  const rightImgRef = useRef<HTMLImageElement>(null);

  // Track loading state for images
  const [leftLoaded, setLeftLoaded] = useState(false);
  const [rightLoaded, setRightLoaded] = useState(false);

  // Reset loading state when content changes, but check for cached images
  useEffect(() => {
    setLeftLoaded(false);
    setRightLoaded(false);

    // Check if images are already cached (complete) after a microtask
    // This handles the case where onLoad fires before the handler is attached
    queueMicrotask(() => {
      if (leftImgRef.current?.complete && leftImgRef.current?.naturalHeight > 0) {
        setLeftLoaded(true);
      }
      if (rightImgRef.current?.complete && rightImgRef.current?.naturalHeight > 0) {
        setRightLoaded(true);
      }
    });
  }, [content.imageUrl, rightContent?.imageUrl]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        onNextPage?.();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        onPrevPage?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPrevPage, onNextPage]);

  // Handle click navigation (left half = prev, right half = next)
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeftHalf = clickX < rect.width / 2;

    if (settings.comicRtl) {
      // Right-to-left (manga mode)
      isLeftHalf ? onNextPage?.() : onPrevPage?.();
    } else {
      // Left-to-right (normal)
      isLeftHalf ? onPrevPage?.() : onNextPage?.();
    }
  };

  // Common image styles
  const imageStyle = {
    objectFit: settings.comicFitMode === "contain" ? ("contain" as const) : undefined,
    height: "100%",
    maxHeight: "100%",
  };

  return (
    <div
      className="h-full flex items-center justify-center overflow-auto cursor-pointer"
      style={{ backgroundColor: theme.background }}
      onClick={handleClick}
    >
      {showSpread ? (
        // Two-page spread view
        <div className="h-full flex items-center justify-center gap-1">
          {content.imageUrl && (
            <div className="relative h-full flex items-center justify-center">
              {!leftLoaded && <ImageLoadingPlaceholder />}
              <img
                ref={leftImgRef}
                src={content.imageUrl}
                alt={content.chapterTitle || "Left Page"}
                style={{
                  ...imageStyle,
                  opacity: leftLoaded ? 1 : 0,
                  transition: "opacity 0.2s ease-in-out",
                }}
                onLoad={() => setLeftLoaded(true)}
              />
            </div>
          )}
          {rightContent.imageUrl && (
            <div className="relative h-full flex items-center justify-center">
              {!rightLoaded && <ImageLoadingPlaceholder />}
              <img
                ref={rightImgRef}
                src={rightContent.imageUrl}
                alt={rightContent.chapterTitle || "Right Page"}
                style={{
                  ...imageStyle,
                  opacity: rightLoaded ? 1 : 0,
                  transition: "opacity 0.2s ease-in-out",
                }}
                onLoad={() => setRightLoaded(true)}
              />
            </div>
          )}
        </div>
      ) : (
        // Single page view
        content.imageUrl && (
          <div className="relative h-full flex items-center justify-center">
            {!leftLoaded && <ImageLoadingPlaceholder />}
            <img
              ref={leftImgRef}
              src={content.imageUrl}
              alt={content.chapterTitle || "Page"}
              className="max-h-full"
              style={{
                objectFit: settings.comicFitMode === "contain" ? "contain" : undefined,
                width: settings.comicFitMode === "width" ? "100%" : "auto",
                height: settings.comicFitMode === "height" ? "100%" : "auto",
                opacity: leftLoaded ? 1 : 0,
                transition: "opacity 0.2s ease-in-out",
              }}
              onLoad={() => setLeftLoaded(true)}
            />
          </div>
        )
      )}
    </div>
  );
}

/**
 * Audio content renderer (Audiobooks)
 */
function AudioContent({
  content,
  settings,
  chapters: _chapters,
  totalDuration,
}: {
  content: PageContent;
  settings: ReaderSettings;
  chapters?: AudioChapter[];
  totalDuration?: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(content.startTime || 0);
  const [volume, setVolume] = useState(settings.audioVolume);

  const theme = THEMES[settings.theme];
  const duration = totalDuration || content.endTime || 0;

  // Sync playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = settings.audioPlaybackSpeed;
    }
  }, [settings.audioPlaybackSpeed]);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Jump to chapter start time
  useEffect(() => {
    if (audioRef.current && content.startTime !== undefined) {
      audioRef.current.currentTime = content.startTime;
    }
  }, [content.startTime]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skipBack = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 30);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="h-full flex flex-col items-center justify-center p-8"
      style={{ backgroundColor: theme.background, color: theme.foreground }}
    >
      <audio
        ref={audioRef}
        src={content.audioUrl}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Chapter info */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold mb-2">{content.chapterTitle || "Now Playing"}</h2>
        {content.chapter && (
          <p className="text-sm" style={{ color: theme.muted }}>
            Chapter {content.chapter.index + 1}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-lg mb-4">
        <input
          type="range"
          min={0}
          max={duration}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-sm mt-1" style={{ color: theme.muted }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-6 mb-8">
        <button
          onClick={skipBack}
          className="p-3 rounded-full hover:bg-black/10 transition-colors"
          aria-label="Skip back 15 seconds"
        >
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            <text x="9" y="15" fontSize="6" fontWeight="bold">
              15
            </text>
          </svg>
        </button>

        <button
          onClick={togglePlay}
          className="p-4 rounded-full bg-black/10 hover:bg-black/20 transition-colors"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          onClick={skipForward}
          className="p-3 rounded-full hover:bg-black/10 transition-colors"
          aria-label="Skip forward 30 seconds"
        >
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
            <text x="9" y="15" fontSize="6" fontWeight="bold">
              30
            </text>
          </svg>
        </button>
      </div>

      {/* Volume control */}
      <div className="flex items-center gap-2 w-full max-w-xs">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3z" />
        </svg>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
      </div>

      {/* Playback speed */}
      <div className="mt-4 text-sm" style={{ color: theme.muted }}>
        Speed: {settings.audioPlaybackSpeed}x
      </div>
    </div>
  );
}
