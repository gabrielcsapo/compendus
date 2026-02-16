import { db, books } from "../db";
import { or, like } from "drizzle-orm";
import type { Book } from "../db/schema";

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  searchIn?: ("title" | "subtitle" | "authors" | "description")[];
}

export interface SearchResult {
  book: Book;
  relevance: number;
  highlights: {
    title?: string;
    subtitle?: string;
    authors?: string;
    description?: string;
  };
}

export async function searchBooks(options: SearchOptions): Promise<SearchResult[]> {
  const { query, limit = 20, offset = 0, searchIn = ["title", "subtitle", "authors", "description"] } = options;

  if (!query || query.trim().length < 2) return [];

  const searchTerm = `%${query}%`;

  const conditions = [];
  if (searchIn.includes("title")) {
    conditions.push(like(books.title, searchTerm));
  }
  if (searchIn.includes("subtitle")) {
    conditions.push(like(books.subtitle, searchTerm));
  }
  if (searchIn.includes("authors")) {
    conditions.push(like(books.authors, searchTerm));
  }
  if (searchIn.includes("description")) {
    conditions.push(like(books.description, searchTerm));
  }

  if (conditions.length === 0) return [];

  const results = await db
    .select()
    .from(books)
    .where(or(...conditions))
    .limit(limit)
    .offset(offset);

  return results.map((book) => ({
    book,
    relevance: 0,
    highlights: {
      title: book.title,
      subtitle: book.subtitle ?? undefined,
      authors: book.authors ?? undefined,
      description: book.description ?? undefined,
    },
  }));
}
