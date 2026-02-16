import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { processBook } from "../../app/lib/processing";
import { db, books } from "../../app/lib/db";

const app = new Hono();

// POST /api/upload - upload a book file
app.post("/api/upload", async (c) => {
  try {
    const formData = await c.req.raw.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ success: false, error: "no_file" }, 400);
    }

    // Validate file type
    const validExtensions = [
      ".pdf",
      ".epub",
      ".mobi",
      ".azw",
      ".azw3",
      ".cbr",
      ".cbz",
      ".m4b",
      ".m4a",
      ".mp3",
    ];
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext),
    );

    if (!hasValidExtension) {
      return c.json({ success: false, error: "invalid_format" }, 400);
    }

    // Extract optional metadata overrides from form data
    const metadata: Record<string, unknown> = {};
    const metadataFields = [
      "title",
      "isbn",
      "isbn13",
      "isbn10",
      "publisher",
      "publishedDate",
      "description",
      "language",
    ];
    for (const field of metadataFields) {
      const value = formData.get(field);
      if (value && typeof value === "string") {
        metadata[field] = value;
      }
    }
    // Handle authors as JSON array
    const authorsStr = formData.get("authors");
    if (authorsStr && typeof authorsStr === "string") {
      try {
        metadata.authors = JSON.parse(authorsStr);
      } catch {
        metadata.authors = [authorsStr];
      }
    }
    // Handle pageCount as number
    const pageCountStr = formData.get("pageCount");
    if (pageCountStr && typeof pageCountStr === "string") {
      metadata.pageCount = parseInt(pageCountStr, 10);
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process the book with metadata overrides
    const result = await processBook(buffer, file.name, {
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });

    if (result.success && result.bookId) {
      const book = await db.select().from(books).where(eq(books.id, result.bookId)).get();
      if (book) {
        return c.json({
          success: true,
          book: {
            id: book.id,
            title: book.title,
            format: book.format,
          },
        });
      }
    }

    return c.json(result, result.success ? 200 : 400);
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ success: false, error: "upload_failed" }, 500);
  }
});

// POST /api/upload-multifile - upload multiple audio files as a single audiobook
app.post("/api/upload-multifile", async (c) => {
  try {
    const { processMultiFileAudiobookWithProgress } = await import("../../app/lib/processing");
    const { isFFmpegAvailable } = await import("../../app/lib/processing/audio");

    // Check if ffmpeg is available first
    if (!(await isFFmpegAvailable())) {
      return c.json({ success: false, error: "ffmpeg_not_installed" }, 400);
    }

    const formData = await c.req.raw.formData();
    const folderName = formData.get("folderName") as string;

    if (!folderName) {
      return c.json({ success: false, error: "no_folder_name" }, 400);
    }

    // Extract files from form data
    const files: Array<{ buffer: Buffer; fileName: string }> = [];
    const validExtensions = [".mp3", ".m4a", ".m4b"];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File) {
        const hasValidExtension = validExtensions.some((ext) =>
          value.name.toLowerCase().endsWith(ext),
        );
        if (hasValidExtension) {
          const arrayBuffer = await value.arrayBuffer();
          files.push({
            buffer: Buffer.from(arrayBuffer),
            fileName: value.name,
          });
        }
      }
    }

    if (files.length < 2) {
      return c.json({ success: false, error: "need_multiple_files" }, 400);
    }

    // Create job ID immediately so we can return it to the client
    const { createJob } = await import("../../app/lib/jobs");
    const jobId = `merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createJob(jobId);

    // Start processing in the background (don't await)
    processMultiFileAudiobookWithProgress(files, folderName, {}, jobId)
      .catch((error) => {
        console.error("Background merge error:", error);
      });

    // Return immediately with jobId so client can subscribe to SSE
    return c.json({
      success: true,
      jobId,
      pending: true,
    });
  } catch (error) {
    console.error("Multi-file upload error:", error);
    return c.json({ success: false, error: "upload_failed" }, 500);
  }
});

export { app as uploadRoutes };
