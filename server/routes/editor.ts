import { Hono } from "hono";
import { readFile, copyFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { eq } from "drizzle-orm";
import { db, books } from "../../app/lib/db";
import { resolveStoragePath } from "../../app/lib/storage";
import { invalidateContent } from "../../app/lib/reader/content-store";
import {
  openSession,
  closeSession,
  getSession,
  hasSession,
  getFileContent,
  setFileContent,
  saveSession,
  getStructure,
  updateSpine,
  addFile,
  removeFile,
} from "../../app/lib/editor/epub-session";

const app = new Hono();

/**
 * Resolve the EPUB file path for a book.
 * Prefers converted EPUB if available, otherwise the original file.
 */
async function resolveEpubPath(bookId: string): Promise<{ book: any; epubPath: string } | null> {
  const book = await db.query.books.findFirst({
    where: eq(books.id, bookId),
  });
  if (!book) return null;

  // Use converted EPUB if available, otherwise original
  let filePath: string;
  if (book.convertedEpubPath) {
    filePath = resolveStoragePath(book.convertedEpubPath);
  } else if (book.format === "epub") {
    filePath = resolveStoragePath(book.filePath);
  } else {
    return null; // Not an EPUB
  }

  if (!existsSync(filePath)) return null;

  return { book, epubPath: filePath };
}

/**
 * POST /api/editor/:bookId/session/open
 * Opens an editing session. Loads the EPUB into memory.
 * Creates a .epub.bak backup if one doesn't exist.
 * Returns the EPUB structure.
 */
app.post("/api/editor/:bookId/session/open", async (c) => {
  const bookId = c.req.param("bookId");

  // If session already exists, return existing structure
  if (hasSession(bookId)) {
    const structure = await getStructure(bookId);
    return c.json({ success: true, structure });
  }

  const resolved = await resolveEpubPath(bookId);
  if (!resolved) {
    return c.json({ success: false, error: "EPUB file not found" }, 404);
  }

  // Create backup if it doesn't exist
  const backupPath = resolved.epubPath + ".bak";
  if (!existsSync(backupPath)) {
    await copyFile(resolved.epubPath, backupPath);
    console.log(`[Editor] Created backup at ${backupPath}`);
  }

  const buffer = await readFile(resolved.epubPath);
  const structure = await openSession(bookId, buffer);

  return c.json({ success: true, structure });
});

/**
 * DELETE /api/editor/:bookId/session
 * Discards the session without saving.
 */
app.delete("/api/editor/:bookId/session", async (c) => {
  const bookId = c.req.param("bookId");
  closeSession(bookId);
  return c.json({ success: true });
});

/**
 * GET /api/editor/:bookId/structure
 * Returns the EPUB structure of the current session.
 */
app.get("/api/editor/:bookId/structure", async (c) => {
  const bookId = c.req.param("bookId");
  const structure = await getStructure(bookId);

  if (!structure) {
    return c.json({ success: false, error: "No editing session found" }, 404);
  }

  return c.json({ success: true, structure });
});

/**
 * GET /api/editor/:bookId/file?path=OEBPS/chapter-1.xhtml
 * Returns the raw text content of a file from the in-memory ZIP.
 */
app.get("/api/editor/:bookId/file", async (c) => {
  const bookId = c.req.param("bookId");
  const path = c.req.query("path");

  if (!path) {
    return c.json({ success: false, error: "Missing path parameter" }, 400);
  }

  const content = await getFileContent(bookId, path);
  if (content === null) {
    return c.json({ success: false, error: "File not found or no session" }, 404);
  }

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
});

/**
 * PUT /api/editor/:bookId/file?path=OEBPS/chapter-1.xhtml
 * Updates a single file in the in-memory ZIP.
 * Body: the new file content as text/plain.
 */
app.put("/api/editor/:bookId/file", async (c) => {
  const bookId = c.req.param("bookId");
  const path = c.req.query("path");

  if (!path) {
    return c.json({ success: false, error: "Missing path parameter" }, 400);
  }

  const content = await c.req.text();
  await setFileContent(bookId, path, content);

  return c.json({ success: true });
});

/**
 * POST /api/editor/:bookId/session/save
 * Repacks the EPUB from the in-memory ZIP and writes to disk.
 * Invalidates the reader content cache.
 */
app.post("/api/editor/:bookId/session/save", async (c) => {
  const bookId = c.req.param("bookId");

  const session = getSession(bookId);
  if (!session) {
    return c.json({ success: false, error: "No editing session found" }, 404);
  }

  const resolved = await resolveEpubPath(bookId);
  if (!resolved) {
    return c.json({ success: false, error: "Book not found" }, 404);
  }

  const buffer = await saveSession(bookId);
  await writeFile(resolved.epubPath, buffer);

  // Update file size in DB
  const fileSize = buffer.length;
  if (resolved.book.convertedEpubPath) {
    await db
      .update(books)
      .set({ convertedEpubSize: fileSize })
      .where(eq(books.id, bookId));
  } else {
    await db
      .update(books)
      .set({ fileSize })
      .where(eq(books.id, bookId));
  }

  // Invalidate reader cache
  invalidateContent(bookId);

  console.log(`[Editor] Saved EPUB for book ${bookId} (${(fileSize / 1024).toFixed(1)} KB)`);

  return c.json({ success: true, fileSize });
});

/**
 * PUT /api/editor/:bookId/structure
 * Updates the spine order.
 * Body: { spine: string[] }
 */
app.put("/api/editor/:bookId/structure", async (c) => {
  const bookId = c.req.param("bookId");
  const body = await c.req.json();

  if (!body.spine || !Array.isArray(body.spine)) {
    return c.json({ success: false, error: "Missing spine array" }, 400);
  }

  await updateSpine(bookId, body.spine);
  const structure = await getStructure(bookId);

  return c.json({ success: true, structure });
});

/**
 * POST /api/editor/:bookId/file/add
 * Adds a new file to the EPUB.
 * Body: { path, content, mediaType, addToSpine? }
 */
app.post("/api/editor/:bookId/file/add", async (c) => {
  const bookId = c.req.param("bookId");
  const body = await c.req.json();

  if (!body.path || !body.content || !body.mediaType) {
    return c.json({ success: false, error: "Missing path, content, or mediaType" }, 400);
  }

  await addFile(bookId, body.path, body.content, body.mediaType, body.addToSpine ?? false);
  const structure = await getStructure(bookId);

  return c.json({ success: true, structure });
});

/**
 * DELETE /api/editor/:bookId/file?path=OEBPS/chapter-5.xhtml
 * Removes a file from the EPUB.
 */
app.delete("/api/editor/:bookId/file", async (c) => {
  const bookId = c.req.param("bookId");
  const path = c.req.query("path");

  if (!path) {
    return c.json({ success: false, error: "Missing path parameter" }, 400);
  }

  await removeFile(bookId, path);
  const structure = await getStructure(bookId);

  return c.json({ success: true, structure });
});

export { app as editorRoutes };
