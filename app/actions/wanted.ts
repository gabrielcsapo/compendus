"use server";

import { v4 as uuid } from "uuid";
import { db, wantedBooks, books } from "../lib/db";
import { eq, desc, sql, and, or, inArray } from "drizzle-orm";
import type { WantedBook } from "../lib/db/schema.js";
import type { MetadataSearchResult } from "../lib/metadata/index.js";

export async function getWantedBooks(
  options?: {
    status?: WantedBook["status"];
    series?: string;
    limit?: number;
    filterOwned?: boolean; // Default true - removes books now in library
  },
  profileId?: string,
): Promise<{ books: WantedBook[]; removed: number }> {
  const filterOwned = options?.filterOwned !== false;

  let query = db.select().from(wantedBooks).$dynamic();

  const conditions = [];
  if (profileId) {
    conditions.push(eq(wantedBooks.profileId, profileId));
  }
  if (options?.status) {
    conditions.push(eq(wantedBooks.status, options.status));
  }
  if (options?.series) {
    conditions.push(eq(wantedBooks.series, options.series));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  query = query.orderBy(desc(wantedBooks.priority), desc(wantedBooks.createdAt));

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const allBooks = await query;

  if (!filterOwned) {
    return { books: allBooks, removed: 0 };
  }

  // Filter out books that are now in the library (batch approach)
  // Collect all ISBNs and titles from wanted books
  const allIsbns = new Set<string>();
  const allTitles = new Set<string>();
  for (const book of allBooks) {
    if (book.isbn) allIsbns.add(book.isbn);
    if (book.isbn13) allIsbns.add(book.isbn13);
    if (book.isbn10) allIsbns.add(book.isbn10);
    if (book.title) allTitles.add(book.title.toLowerCase());
  }

  // Single query: find owned books by any matching ISBN
  const ownedByIsbn = new Set<string>();
  if (allIsbns.size > 0) {
    const isbnArr = [...allIsbns];
    const ownedRows = await db
      .select({ isbn: books.isbn, isbn13: books.isbn13, isbn10: books.isbn10 })
      .from(books)
      .where(
        or(
          inArray(books.isbn, isbnArr),
          inArray(books.isbn13, isbnArr),
          inArray(books.isbn10, isbnArr),
        ),
      );
    for (const row of ownedRows) {
      if (row.isbn) ownedByIsbn.add(row.isbn);
      if (row.isbn13) ownedByIsbn.add(row.isbn13);
      if (row.isbn10) ownedByIsbn.add(row.isbn10);
    }
  }

  // Single query: find owned books by title
  const ownedTitles = new Set<string>();
  if (allTitles.size > 0) {
    const titleRows = await db
      .select({ title: books.title })
      .from(books)
      .where(
        sql`lower(${books.title}) IN (${sql.join(
          [...allTitles].map((t) => sql`${t}`),
          sql`, `,
        )})`,
      );
    for (const row of titleRows) {
      ownedTitles.add(row.title.toLowerCase());
    }
  }

  // Now filter without any per-book queries
  const idsToRemove: string[] = [];
  const filteredBooks: WantedBook[] = [];

  for (const book of allBooks) {
    const isbnMatch =
      (book.isbn && ownedByIsbn.has(book.isbn)) ||
      (book.isbn13 && ownedByIsbn.has(book.isbn13)) ||
      (book.isbn10 && ownedByIsbn.has(book.isbn10));
    const titleMatch = book.title && ownedTitles.has(book.title.toLowerCase());

    if (isbnMatch || titleMatch) {
      idsToRemove.push(book.id);
    } else {
      filteredBooks.push(book);
    }
  }

  // Batch delete owned books from wishlist
  if (idsToRemove.length > 0) {
    await db.delete(wantedBooks).where(inArray(wantedBooks.id, idsToRemove));
  }

  return { books: filteredBooks, removed: idsToRemove.length };
}

async function getWantedBook(id: string, profileId?: string): Promise<WantedBook | null> {
  const conditions = [eq(wantedBooks.id, id)];
  if (profileId) {
    conditions.push(eq(wantedBooks.profileId, profileId));
  }
  const result = await db
    .select()
    .from(wantedBooks)
    .where(and(...conditions))
    .get();
  return result || null;
}

export async function addToWantedList(
  metadata: MetadataSearchResult,
  options?: {
    status?: WantedBook["status"];
    priority?: number;
    notes?: string;
  },
  profileId?: string,
): Promise<WantedBook> {
  const id = uuid();

  // Check if already in wanted list by source
  if (metadata.sourceId) {
    const sourceConditions = [
      eq(wantedBooks.source, metadata.source),
      eq(wantedBooks.sourceId, metadata.sourceId),
    ];
    if (profileId) {
      sourceConditions.push(eq(wantedBooks.profileId, profileId));
    }

    const existingBySource = await db
      .select()
      .from(wantedBooks)
      .where(and(...sourceConditions))
      .get();

    if (existingBySource) {
      throw new Error("Book is already in your wanted list");
    }
  }

  // Check if already in library by ISBN
  if (metadata.isbn13 || metadata.isbn10 || metadata.isbn) {
    const conditions = [];
    if (metadata.isbn13) conditions.push(eq(books.isbn13, metadata.isbn13));
    if (metadata.isbn10) conditions.push(eq(books.isbn10, metadata.isbn10));
    if (metadata.isbn) conditions.push(eq(books.isbn, metadata.isbn));

    const inLibrary = await db
      .select()
      .from(books)
      .where(or(...conditions))
      .get();

    if (inLibrary) {
      throw new Error("You already own this book");
    }
  }

  await db.insert(wantedBooks).values({
    id,
    profileId: profileId!,
    title: metadata.title,
    subtitle: metadata.subtitle,
    authors: metadata.authors.length > 0 ? JSON.stringify(metadata.authors) : null,
    publisher: metadata.publisher,
    publishedDate: metadata.publishedDate,
    description: metadata.description,
    isbn: metadata.isbn,
    isbn13: metadata.isbn13,
    isbn10: metadata.isbn10,
    language: metadata.language,
    pageCount: metadata.pageCount,
    series: metadata.series,
    seriesNumber: metadata.seriesNumber,
    coverUrl: metadata.coverUrl,
    source: metadata.source,
    sourceId: metadata.sourceId,
    status: options?.status || "wishlist",
    priority: options?.priority || 0,
    notes: options?.notes,
  });

  return (await getWantedBook(id, profileId))!;
}

export async function updateWantedBook(
  id: string,
  data: Partial<{
    status: WantedBook["status"];
    priority: number;
    notes: string;
  }>,
  profileId?: string,
): Promise<WantedBook | null> {
  const conditions = [eq(wantedBooks.id, id)];
  if (profileId) {
    conditions.push(eq(wantedBooks.profileId, profileId));
  }

  await db
    .update(wantedBooks)
    .set({ ...data, updatedAt: sql`(unixepoch())` })
    .where(and(...conditions));

  return getWantedBook(id, profileId);
}

export async function removeFromWantedList(id: string, profileId?: string): Promise<boolean> {
  const conditions = [eq(wantedBooks.id, id)];
  if (profileId) {
    conditions.push(eq(wantedBooks.profileId, profileId));
  }
  await db.delete(wantedBooks).where(and(...conditions));
  return true;
}

export async function clearWantedList(profileId?: string): Promise<number> {
  if (profileId) {
    const result = await db
      .delete(wantedBooks)
      .where(eq(wantedBooks.profileId, profileId))
      .returning({ id: wantedBooks.id });
    return result.length;
  }
  const result = await db.delete(wantedBooks).returning({ id: wantedBooks.id });
  return result.length;
}

export async function isBookWanted(
  metadata: MetadataSearchResult,
  profileId?: string,
): Promise<boolean> {
  // Check by source ID
  if (metadata.sourceId) {
    const sourceConditions = [
      eq(wantedBooks.source, metadata.source),
      eq(wantedBooks.sourceId, metadata.sourceId),
    ];
    if (profileId) {
      sourceConditions.push(eq(wantedBooks.profileId, profileId));
    }

    const bySource = await db
      .select()
      .from(wantedBooks)
      .where(and(...sourceConditions))
      .get();

    if (bySource) return true;
  }

  // Check by ISBN
  if (metadata.isbn13 || metadata.isbn10) {
    const conditions = [];
    if (metadata.isbn13) conditions.push(eq(wantedBooks.isbn13, metadata.isbn13));
    if (metadata.isbn10) conditions.push(eq(wantedBooks.isbn10, metadata.isbn10));

    if (profileId) {
      const byIsbn = await db
        .select()
        .from(wantedBooks)
        .where(and(or(...conditions), eq(wantedBooks.profileId, profileId)))
        .get();

      if (byIsbn) return true;
    } else {
      const byIsbn = await db
        .select()
        .from(wantedBooks)
        .where(or(...conditions))
        .get();

      if (byIsbn) return true;
    }
  }

  return false;
}

export async function isBookOwned(metadata: MetadataSearchResult): Promise<boolean> {
  if (!metadata.isbn13 && !metadata.isbn10 && !metadata.isbn) {
    return false;
  }

  const conditions = [];
  if (metadata.isbn13) conditions.push(eq(books.isbn13, metadata.isbn13));
  if (metadata.isbn10) conditions.push(eq(books.isbn10, metadata.isbn10));
  if (metadata.isbn) conditions.push(eq(books.isbn, metadata.isbn));

  const owned = await db
    .select()
    .from(books)
    .where(or(...conditions))
    .get();

  return !!owned;
}
