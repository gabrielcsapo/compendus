import { Hono } from "hono";
import { resolve } from "path";
import { BOOKS_DIR } from "../../app/lib/storage";
import { streamFileResponse } from "../lib/file-serving";
import { db, rawDb, bookSubjects, backgroundJobs } from "../../app/lib/db";
import { eq, sql } from "drizzle-orm";
import { findBestMetadata } from "../../app/lib/metadata";
import { randomUUID } from "crypto";

const app = new Hono();

// POST /api/admin/enrich-subjects - Batch enrich books with subjects from external metadata
app.post("/api/admin/enrich-subjects", async (c) => {
  // Find books that have an ISBN but no subjects yet
  const booksNeedingSubjects = rawDb
    .prepare(
      `
    SELECT b.id, b.title, b.authors, b.isbn, b.isbn13, b.isbn10
    FROM books b
    WHERE (b.isbn IS NOT NULL OR b.isbn13 IS NOT NULL OR b.isbn10 IS NOT NULL)
      AND b.id NOT IN (SELECT DISTINCT book_id FROM book_subjects)
  `,
    )
    .all() as Array<{
    id: string;
    title: string;
    authors: string | null;
    isbn: string | null;
    isbn13: string | null;
    isbn10: string | null;
  }>;

  if (booksNeedingSubjects.length === 0) {
    return c.json({ message: "All books with ISBNs already have subjects", count: 0 });
  }

  // Create a background job to track progress
  const jobId = randomUUID();
  await db.insert(backgroundJobs).values({
    id: jobId,
    type: "enrich-subjects",
    status: "running",
    progress: 0,
    message: `Enriching subjects for ${booksNeedingSubjects.length} books...`,
  });

  // Run enrichment in the background
  (async () => {
    let enriched = 0;
    let failed = 0;

    for (let i = 0; i < booksNeedingSubjects.length; i++) {
      const book = booksNeedingSubjects[i];
      try {
        const metadata = await findBestMetadata({
          title: book.title,
          authors: book.authors ? JSON.parse(book.authors) : [],
          isbn: book.isbn13 || book.isbn10 || book.isbn,
        });

        if (metadata && metadata.subjects.length > 0) {
          const subjects = metadata.subjects
            .map((s) => s.toLowerCase().trim())
            .filter((s) => s.length > 0 && s.length < 100)
            .slice(0, 20);

          if (subjects.length > 0) {
            await db.insert(bookSubjects).values(
              subjects.map((subject) => ({
                id: randomUUID(),
                bookId: book.id,
                subject,
              })),
            );
            enriched++;
          }
        }
      } catch {
        failed++;
      }

      // Update progress
      const progress = Math.round(((i + 1) / booksNeedingSubjects.length) * 100);
      await db
        .update(backgroundJobs)
        .set({
          progress,
          message: `Processed ${i + 1}/${booksNeedingSubjects.length} (${enriched} enriched, ${failed} failed)`,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(backgroundJobs.id, jobId));

      // Throttle to avoid API rate limits (1 request per second)
      if (i < booksNeedingSubjects.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    await db
      .update(backgroundJobs)
      .set({
        status: "completed",
        progress: 100,
        message: `Done: ${enriched} books enriched, ${failed} failed out of ${booksNeedingSubjects.length}`,
        result: JSON.stringify({ enriched, failed, total: booksNeedingSubjects.length }),
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(backgroundJobs.id, jobId));
  })();

  return c.json({
    jobId,
    message: `Started enriching ${booksNeedingSubjects.length} books`,
    count: booksNeedingSubjects.length,
  });
});

// GET /api/admin/preview/:filename - Preview an orphaned file from the books directory
app.get("/api/admin/preview/:filename", async (c) => {
  const filename = c.req.param("filename");

  // Security: only allow simple filenames (no path traversal)
  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  const filePath = resolve(BOOKS_DIR, filename);

  // Double-check the resolved path is still within BOOKS_DIR
  if (!filePath.startsWith(BOOKS_DIR)) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  return streamFileResponse(c, filePath, {
    cacheControl: "no-cache",
  });
});

export const adminRoutes = app;
