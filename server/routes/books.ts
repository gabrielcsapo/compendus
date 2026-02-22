import { Hono } from "hono";
import { apiListBooks, apiGetBook, apiLookupByIsbn } from "../../app/lib/api/search";

const app = new Hono();

// GET /api/books - list all books
app.get("/api/books", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);
  const type = c.req.query("type") as "ebook" | "audiobook" | "comic" | undefined;
  const orderBy = c.req.query("orderBy") as "title" | "createdAt" | undefined;
  const order = c.req.query("order") as "asc" | "desc" | undefined;
  const series = c.req.query("series");

  const baseUrl = new URL(c.req.url).origin;
  const result = await apiListBooks(
    { limit, offset, type: type || undefined, orderBy: orderBy || undefined, order: order || undefined, series: series || undefined },
    baseUrl,
  );
  return c.json(result, result.success ? 200 : 400);
});

// GET /api/books/isbn/:isbn - lookup by ISBN (must be before :id route)
app.get("/api/books/isbn/:isbn", async (c) => {
  const isbn = c.req.param("isbn");
  const baseUrl = new URL(c.req.url).origin;
  const result = await apiLookupByIsbn(isbn, baseUrl);
  return c.json(result, result.success ? 200 : 404);
});

// GET /api/books/:id - get book by ID
app.get("/api/books/:id", async (c) => {
  const id = c.req.param("id");
  const baseUrl = new URL(c.req.url).origin;
  const result = await apiGetBook(id, baseUrl);
  return c.json(result, result.success ? 200 : 404);
});

export { app as booksRoutes };
