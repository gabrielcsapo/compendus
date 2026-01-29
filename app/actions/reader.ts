"use server";

import { db, books, bookmarks, highlights } from "../lib/db";
import { eq, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { getContent, paginationEngine } from "../lib/reader";
import type { ViewportConfig, TocEntry, PageContent, ReaderInfoResponse, ReaderPageResponse } from "../lib/reader/types";

// ============================================
// BOOKMARKS
// ============================================

export interface Bookmark {
  id: string;
  bookId: string;
  position: number;
  title: string | null;
  note: string | null;
  color: string | null;
  createdAt?: string;
}

export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const bookmarksList = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.bookId, bookId))
    .all();

  return bookmarksList.map((b) => ({
    id: b.id,
    bookId: b.bookId,
    position: parseFloat(b.position),
    title: b.title,
    note: b.note,
    color: b.color,
    createdAt: b.createdAt?.toISOString(),
  }));
}

export async function addBookmark(
  bookId: string,
  position: number,
  title?: string,
  note?: string,
  color?: string,
): Promise<Bookmark> {
  const id = uuid();
  await db.insert(bookmarks).values({
    id,
    bookId,
    position: position.toString(),
    title: title || null,
    note: note || null,
    color: color || null,
  });

  return { id, bookId, position, title: title || null, note: note || null, color: color || null };
}

export async function deleteBookmark(bookmarkId: string): Promise<void> {
  await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId));
}

// ============================================
// HIGHLIGHTS
// ============================================

export interface Highlight {
  id: string;
  bookId: string;
  startPosition: number;
  endPosition: number;
  text: string;
  note: string | null;
  color: string;
  createdAt?: string;
}

export async function getHighlights(bookId: string): Promise<Highlight[]> {
  const highlightsList = await db
    .select()
    .from(highlights)
    .where(eq(highlights.bookId, bookId))
    .all();

  return highlightsList.map((h) => ({
    id: h.id,
    bookId: h.bookId,
    startPosition: parseFloat(h.startPosition),
    endPosition: parseFloat(h.endPosition),
    text: h.text,
    note: h.note,
    color: h.color,
    createdAt: h.createdAt?.toISOString(),
  }));
}

export async function addHighlight(
  bookId: string,
  startPosition: number,
  endPosition: number,
  text: string,
  note?: string,
  color?: string,
): Promise<Highlight> {
  const id = uuid();
  const highlightColor = color || "#ffff00";

  await db.insert(highlights).values({
    id,
    bookId,
    startPosition: startPosition.toString(),
    endPosition: endPosition.toString(),
    text,
    note: note || null,
    color: highlightColor,
  });

  return {
    id,
    bookId,
    startPosition,
    endPosition,
    text,
    note: note || null,
    color: highlightColor,
  };
}

export async function deleteHighlight(highlightId: string): Promise<void> {
  await db.delete(highlights).where(eq(highlights.id, highlightId));
}

// ============================================
// READING PROGRESS
// ============================================

export async function saveReadingProgress(
  bookId: string,
  position: number,
  pageNum?: number,
): Promise<{ position: number; pageNum?: number }> {
  await db
    .update(books)
    .set({
      readingProgress: position,
      lastPosition: JSON.stringify({ position, pageNum }),
      lastReadAt: sql`(unixepoch())`,
      updatedAt: sql`(unixepoch())`,
    })
    .where(eq(books.id, bookId));

  return { position, pageNum };
}

export async function getReadingProgress(bookId: string): Promise<{
  position: number;
  pageNum?: number;
} | null> {
  const book = await db
    .select({ readingProgress: books.readingProgress, lastPosition: books.lastPosition })
    .from(books)
    .where(eq(books.id, bookId))
    .get();

  if (!book) return null;

  const lastPosition = book.lastPosition ? JSON.parse(book.lastPosition) : null;
  return {
    position: book.readingProgress || 0,
    pageNum: lastPosition?.pageNum,
  };
}

// ============================================
// READER CONTENT
// ============================================

export async function getReaderInfo(
  bookId: string,
  viewport: ViewportConfig,
): Promise<ReaderInfoResponse | null> {
  // Get book from database
  const book = await db.select().from(books).where(eq(books.id, bookId)).get();
  if (!book) return null;

  // Get normalized content
  const content = await getContent(bookId);
  if (!content) return null;

  // Calculate total pages for viewport
  const totalPages = paginationEngine.calculateTotalPages(content, viewport);

  // Get TOC with page numbers
  let toc: TocEntry[] = [];
  if (content.type === "text" || content.type === "pdf") {
    toc = paginationEngine.calculateTocPageNumbers(content, content.toc, viewport);
  }

  const response: ReaderInfoResponse = {
    id: book.id,
    title: book.title,
    format: book.format,
    totalPages,
    toc,
    coverPath: book.coverPath || undefined,
  };

  // Add audio-specific fields
  if (content.type === "audio") {
    response.duration = content.duration;
    response.chapters = content.chapters;
  }

  return response;
}

export async function getReaderPage(
  bookId: string,
  pageNum: number,
  viewport: ViewportConfig,
): Promise<ReaderPageResponse | null> {
  // Get normalized content
  const content = await getContent(bookId);
  if (!content) return null;

  const totalPages = paginationEngine.calculateTotalPages(content, viewport);
  const pageContent = paginationEngine.getPage(content, pageNum, viewport, bookId);

  return {
    pageNum: Math.max(1, Math.min(pageNum, totalPages)),
    totalPages,
    position: pageContent.position,
    content: pageContent,
    nextPage: pageNum < totalPages ? pageNum + 1 : null,
    prevPage: pageNum > 1 ? pageNum - 1 : null,
  };
}

export async function getReaderPageForPosition(
  bookId: string,
  position: number,
  viewport: ViewportConfig,
): Promise<{ pageNum: number; content: PageContent; position: number } | null> {
  // Get normalized content
  const content = await getContent(bookId);
  if (!content) return null;

  const pageNum = paginationEngine.getPageForPosition(content, position, viewport);
  const pageContent = paginationEngine.getPage(content, pageNum, viewport, bookId);

  return {
    pageNum,
    content: pageContent,
    position: pageContent.position,
  };
}

export interface SearchResult {
  pageNum: number;
  text: string;
  context: string;
}

export async function searchInBook(
  bookId: string,
  query: string,
  viewport: ViewportConfig,
): Promise<SearchResult[]> {
  // Get normalized content
  const content = await getContent(bookId);
  if (!content) return [];

  return paginationEngine.searchContent(content, query, viewport);
}
