"use server";

import {
  searchBooks as searchBooksLib,
  searchBooksCount as searchBooksCountLib,
  type SearchOptions,
  type SearchResult,
  type MissingField,
} from "../lib/search";

export type { MissingField };

export async function searchBooks(
  query: string,
  options: Omit<SearchOptions, "query"> = {},
): Promise<SearchResult[]> {
  const hasQuery = query && query.trim().length >= 2;
  const hasMissing = options.missing && options.missing.length > 0;

  if (!hasQuery && !hasMissing) {
    return [];
  }

  return searchBooksLib({
    query: hasQuery ? query : undefined,
    ...options,
  });
}

export async function searchBooksCount(
  query: string,
  options: Omit<SearchOptions, "query" | "limit" | "offset"> = {},
): Promise<number> {
  const hasQuery = query && query.trim().length >= 2;
  const hasMissing = options.missing && options.missing.length > 0;

  if (!hasQuery && !hasMissing) {
    return 0;
  }

  return searchBooksCountLib({
    query: hasQuery ? query : undefined,
    ...options,
  });
}

export interface QuickSearchResult {
  id: string;
  title: string;
  authors: string | null;
  format: string;
  coverPath: string | null;
  coverColor: string | null;
  updatedAt: Date | null;
}

export async function quickSearch(query: string): Promise<QuickSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const results = await searchBooksLib({
    query,
    searchIn: ["title", "authors"],
    limit: 8,
  });

  return results.map((r) => ({
    id: r.book.id,
    title: r.book.title,
    authors: r.book.authors,
    format: r.book.format,
    coverPath: r.book.coverPath,
    coverColor: r.book.coverColor,
    updatedAt: r.book.updatedAt,
  }));
}
