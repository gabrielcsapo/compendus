import { Hono } from "hono";
import { readFile } from "fs/promises";
import { existsSync, statSync, writeFileSync } from "fs";
import { resolve, extname } from "path";
import { eq } from "drizzle-orm";
import { db, books } from "../../app/lib/db";
import { createJob, updateJobProgress, getJob } from "../../app/lib/jobs";
import { convertPdfToEpub } from "../../app/lib/processing/pdf-to-epub";
import { convertMobiToEpub } from "../../app/lib/processing/mobi-to-epub";

const app = new Hono();

const CONVERTIBLE_FORMATS = ["pdf", "mobi", "azw3"];

/**
 * POST /api/books/:id/convert-to-epub
 * Triggers EPUB conversion as a background job.
 * Supports PDF, MOBI, and AZW3 formats.
 * Returns immediately with a jobId for progress tracking.
 */
app.post("/api/books/:id/convert-to-epub", async (c) => {
  const bookId = c.req.param("id");

  // Look up the book
  const book = await db.query.books.findFirst({
    where: eq(books.id, bookId),
  });

  if (!book) {
    return c.json({ success: false, error: "Book not found" }, 404);
  }

  if (!CONVERTIBLE_FORMATS.includes(book.format)) {
    return c.json({
      success: false,
      error: "not_convertible",
      message: "Only PDF and MOBI/AZW3 books can be converted to EPUB",
    }, 400);
  }

  // Check if already converted (allow force reconversion)
  const body = await c.req.json().catch(() => ({}));
  const force = body?.force === true;

  if (book.convertedEpubPath && !force) {
    return c.json({
      success: true,
      alreadyConverted: true,
      convertedEpubSize: book.convertedEpubSize,
    });
  }

  // Check if a conversion job is already running
  const jobId = `convert-${bookId}`;
  const existingJob = getJob(jobId);
  if (existingJob && (existingJob.status === "pending" || existingJob.status === "running")) {
    return c.json({ success: true, jobId, pending: true });
  }

  // Verify source file exists
  const ext = book.fileName ? extname(book.fileName) : `.${book.format}`;
  const bookPath = resolve(process.cwd(), "data", "books", `${bookId}${ext}`);
  if (!existsSync(bookPath)) {
    return c.json({ success: false, error: "Source file not found on disk" }, 404);
  }

  // Create job and return immediately
  createJob(jobId);

  // Run conversion in background
  (async () => {
    try {
      updateJobProgress(jobId, {
        status: "running",
        progress: 1,
        message: `Reading ${book.format.toUpperCase()} file...`,
      });

      const fileBuffer = await readFile(bookPath);

      // Parse metadata from DB
      const authors = book.authors ? JSON.parse(book.authors) : [];
      const metadata = {
        title: book.title,
        authors: Array.isArray(authors) ? authors : [],
        language: book.language ?? undefined,
      };

      const onProgress = (percent: number, message: string) => {
        updateJobProgress(jobId, { status: "running", progress: percent, message });
      };

      let epubBuffer: Buffer;
      if (book.format === "pdf") {
        epubBuffer = await convertPdfToEpub(fileBuffer, metadata, { onProgress });
      } else {
        epubBuffer = await convertMobiToEpub(fileBuffer, metadata, { onProgress });
      }

      // Store the converted EPUB
      const epubPath = resolve(process.cwd(), "data", "books", `${bookId}.epub`);
      writeFileSync(epubPath, epubBuffer);
      const epubSize = statSync(epubPath).size;

      // Update DB
      await db
        .update(books)
        .set({
          convertedEpubPath: `data/books/${bookId}.epub`,
          convertedEpubSize: epubSize,
        })
        .where(eq(books.id, bookId));

      updateJobProgress(jobId, {
        status: "completed",
        progress: 100,
        message: "Conversion complete",
        result: { bookId },
      });

      console.log(`[Convert] ${book.format.toUpperCase()} → EPUB conversion complete for ${bookId} (${(epubSize / 1024).toFixed(1)} KB)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Convert] ${book.format.toUpperCase()} → EPUB conversion failed for ${bookId}:`, errorMessage);

      updateJobProgress(jobId, {
        status: "error",
        progress: 0,
        message: `Conversion failed: ${errorMessage}`,
        result: { error: errorMessage },
      });
    }
  })();

  return c.json({ success: true, jobId, pending: true });
});

/**
 * GET /api/books/:id/epub-status
 * Check if a converted EPUB exists for a book.
 */
app.get("/api/books/:id/epub-status", async (c) => {
  const bookId = c.req.param("id");

  const book = await db.query.books.findFirst({
    where: eq(books.id, bookId),
  });

  if (!book) {
    return c.json({ success: false, error: "Book not found" }, 404);
  }

  if (book.convertedEpubPath) {
    return c.json({
      success: true,
      hasEpub: true,
      convertedEpubSize: book.convertedEpubSize,
    });
  }

  return c.json({ success: true, hasEpub: false });
});

export { app as convertRoutes };
