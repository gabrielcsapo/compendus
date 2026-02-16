import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { processAndStoreCover } from "../../app/lib/processing/cover";
import { db, books } from "../../app/lib/db";

const app = new Hono();

// POST /api/books/:id/cover - upload custom cover image
app.post("/api/books/:id/cover", async (c) => {
  try {
    const bookId = c.req.param("id");

    // Check if book exists
    const book = await db.select().from(books).where(eq(books.id, bookId)).get();
    if (!book) {
      return c.json({ success: false, error: "book_not_found" }, 404);
    }

    const formData = await c.req.raw.formData();
    const file = formData.get("cover") as File | null;

    if (!file) {
      return c.json({ success: false, error: "no_file" }, 400);
    }

    // Validate file type (images only)
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return c.json({ success: false, error: "invalid_format" }, 400);
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process and store the cover
    const result = await processAndStoreCover(buffer, bookId);

    if (result.path) {
      // Update book record with new cover
      await db
        .update(books)
        .set({
          coverPath: result.path,
          coverColor: result.dominantColor,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(books.id, bookId));

      return c.json({
        success: true,
        coverPath: result.path,
        coverColor: result.dominantColor,
      });
    }

    return c.json({ success: false, error: "processing_failed" }, 500);
  } catch (error) {
    console.error("Cover upload error:", error);
    return c.json({ success: false, error: "upload_failed" }, 500);
  }
});

export { app as coverRoutes };
