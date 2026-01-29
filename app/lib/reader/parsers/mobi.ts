import { initMobiFile } from "@lingo-reader/mobi-parser";
import { resolve } from "path";
import { mkdirSync } from "fs";
import type { TextContent, NormalizedChapter, TocEntry } from "../types";

/**
 * Strip HTML tags and normalize whitespace
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sanitize HTML for safe rendering
 * Rewrites image src URLs to point to the MOBI resource API with book-specific paths
 */
function sanitizeHtml(html: string, bookId: string): string {
  return (
    html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "")
      .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, "")
      .replace(/src\s*=\s*["']data:[^"']*["']/gi, "")
      // Rewrite image src URLs - MOBI parser outputs absolute filesystem paths
      .replace(
        /(<img[^>]*\s+src\s*=\s*["'])([^"']+)(["'][^>]*>)/gi,
        (match, before, src, after) => {
          // Skip http/https URLs and data URIs
          if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
            return match;
          }
          // Handle absolute filesystem paths from MOBI parser (e.g., /Users/.../images/{bookId}/7.jpg)
          // Extract just the filename and serve from book-specific path
          const filename = src.split("/").pop() || src;
          return `${before}/mobi-images/${bookId}/${filename}${after}`;
        },
      )
      // Also rewrite SVG image xlink:href URLs
      .replace(
        /(<image[^>]*\s+xlink:href\s*=\s*["'])([^"']+)(["'][^>]*>)/gi,
        (match, before, href, after) => {
          // Skip absolute URLs and data URIs
          if (
            href.startsWith("http://") ||
            href.startsWith("https://") ||
            href.startsWith("data:")
          ) {
            return match;
          }
          // Handle absolute filesystem paths - extract filename
          const filename = href.split("/").pop() || href;
          return `${before}/mobi-images/${bookId}/${filename}${after}`;
        },
      )
      .trim()
  );
}

/**
 * Parse MOBI file into normalized content for the reader
 */
export async function parseMobi(buffer: Buffer, bookId: string): Promise<TextContent> {
  try {
    // Create book-specific directory for extracted resources
    const resourceDir = resolve(process.cwd(), "images", bookId);
    mkdirSync(resourceDir, { recursive: true });

    const mobi = await initMobiFile(new Uint8Array(buffer), resourceDir);

    const spine = mobi.getSpine();
    const toc = mobi.getToc();

    const chapters: NormalizedChapter[] = [];
    let totalCharacters = 0;

    for (let i = 0; i < spine.length; i++) {
      const spineItem = spine[i];
      try {
        const chapterContent = await mobi.loadChapter(spineItem.id);
        const html = sanitizeHtml(chapterContent?.html || "", bookId);
        const text = stripHtml(chapterContent?.html || "");

        // Find matching TOC entry for title
        const tocEntry = toc.find((t) => t.href?.includes(spineItem.id));
        const title = tocEntry?.label || `Chapter ${i + 1}`;

        chapters.push({
          id: spineItem.id,
          title,
          html,
          text,
          characterStart: totalCharacters,
          characterEnd: totalCharacters + text.length,
        });

        totalCharacters += text.length;
      } catch {
        // Skip chapters that fail to load
      }
    }

    // Build TOC with normalized positions
    const normalizedToc = buildToc(toc, chapters, totalCharacters);

    return {
      bookId,
      format: "mobi",
      type: "text",
      chapters,
      totalCharacters,
      toc: normalizedToc,
    };
  } catch {
    return createEmptyContent(bookId);
  }
}

/**
 * Build normalized TOC with positions
 */
function buildToc(
  rawToc: Array<{ label: string; href?: string }>,
  chapters: NormalizedChapter[],
  totalCharacters: number,
): TocEntry[] {
  return rawToc.map((item) => {
    const href = item.href || "";
    const chapter = chapters.find((ch) => ch.id.includes(href) || href.includes(ch.id));
    const position = chapter ? chapter.characterStart / Math.max(1, totalCharacters) : 0;

    return {
      title: item.label,
      position,
      level: 0,
    };
  });
}

/**
 * Create empty content structure for failed parses
 */
function createEmptyContent(bookId: string): TextContent {
  return {
    bookId,
    format: "mobi",
    type: "text",
    chapters: [],
    totalCharacters: 0,
    toc: [],
  };
}
