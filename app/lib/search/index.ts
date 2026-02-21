import { db, books, booksTags } from "../db";
import { or, like, and, inArray, isNull, notInArray, sql, count } from "drizzle-orm";
import type { Book } from "../db/schema";
import type { BookType } from "../book-types";
import { getFormatsByType } from "../book-types";

export type MissingField = "cover" | "authors" | "tags" | "language";

export interface SearchOptions {
  query?: string;
  limit?: number;
  offset?: number;
  searchIn?: ("title" | "subtitle" | "authors" | "description")[];
  type?: BookType;
  missing?: MissingField[];
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

function buildMissingConditions(missing: MissingField[]) {
  const conditions = [];
  if (missing.includes("cover")) {
    conditions.push(isNull(books.coverPath));
  }
  if (missing.includes("authors")) {
    conditions.push(sql`(${books.authors} IS NULL OR ${books.authors} = '[]')`);
  }
  if (missing.includes("tags")) {
    const bookIdsWithTags = db
      .select({ bookId: booksTags.bookId })
      .from(booksTags);
    conditions.push(notInArray(books.id, bookIdsWithTags));
  }
  if (missing.includes("language")) {
    conditions.push(isNull(books.language));
  }
  return conditions;
}

function buildWhereConditions(options: {
  query?: string;
  searchIn: ("title" | "subtitle" | "authors" | "description")[];
  type?: BookType;
  missing?: MissingField[];
}) {
  const { query, searchIn, type, missing } = options;
  const hasQuery = query && query.trim().length >= 2;
  const hasMissing = missing && missing.length > 0;

  if (!hasQuery && !hasMissing) return null;

  const whereConditions = [];

  if (hasQuery) {
    const searchTerm = `%${query}%`;
    const searchConditions = [];
    if (searchIn.includes("title")) {
      searchConditions.push(like(books.title, searchTerm));
    }
    if (searchIn.includes("subtitle")) {
      searchConditions.push(like(books.subtitle, searchTerm));
    }
    if (searchIn.includes("authors")) {
      searchConditions.push(like(books.authors, searchTerm));
    }
    if (searchIn.includes("description")) {
      searchConditions.push(like(books.description, searchTerm));
    }
    if (searchConditions.length > 0) {
      whereConditions.push(or(...searchConditions)!);
    }
  }

  if (type) {
    whereConditions.push(inArray(books.format, getFormatsByType(type)));
  }

  if (hasMissing) {
    const missingConditions = buildMissingConditions(missing);
    if (missingConditions.length > 0) {
      whereConditions.push(or(...missingConditions)!);
    }
  }

  if (whereConditions.length === 0) return null;

  return and(...whereConditions);
}

export async function searchBooks(options: SearchOptions): Promise<SearchResult[]> {
  const { query, limit = 20, offset = 0, searchIn = ["title", "subtitle", "authors", "description"], type, missing } = options;

  const where = buildWhereConditions({ query, searchIn, type, missing });
  if (!where) return [];

  const results = await db
    .select()
    .from(books)
    .where(where)
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

export async function searchBooksCount(options: Omit<SearchOptions, "limit" | "offset">): Promise<number> {
  const { query, searchIn = ["title", "subtitle", "authors", "description"], type, missing } = options;

  const where = buildWhereConditions({ query, searchIn, type, missing });
  if (!where) return 0;

  const result = await db
    .select({ count: count() })
    .from(books)
    .where(where);

  return result[0]?.count ?? 0;
}
