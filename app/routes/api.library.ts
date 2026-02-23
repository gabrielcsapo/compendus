import { getBooks } from "../actions/books";
import type { SortOption } from "../components/SortDropdown";
import type { BookType } from "../lib/book-types";

const BOOKS_PER_PAGE = 24;

function getSortParams(sort: SortOption): {
  orderBy: "title" | "createdAt";
  order: "asc" | "desc";
} {
  switch (sort) {
    case "title-asc":
      return { orderBy: "title", order: "asc" };
    case "title-desc":
      return { orderBy: "title", order: "desc" };
    case "oldest":
      return { orderBy: "createdAt", order: "asc" };
    case "recent":
    default:
      return { orderBy: "createdAt", order: "desc" };
  }
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const sort = (url.searchParams.get("sort") as SortOption) || "recent";
  const typeParam = url.searchParams.get("type") as BookType | null;
  const type = typeParam && ["audiobook", "ebook", "comic"].includes(typeParam) ? typeParam : undefined;
  const formatParam = url.searchParams.get("format");
  const format = formatParam ? formatParam.split(",").filter(Boolean) : undefined;
  const series = url.searchParams.get("series") || undefined;
  const { orderBy, order } = getSortParams(sort);

  const books = await getBooks({
    limit: BOOKS_PER_PAGE,
    offset,
    orderBy,
    order,
    type,
    format,
    series,
  });

  // Serialize dates as ISO strings for JSON consistency
  const serializedBooks = books.map((book) => ({
    ...book,
    createdAt: book.createdAt?.toISOString() ?? null,
    updatedAt: book.updatedAt?.toISOString() ?? null,
    lastReadAt: book.lastReadAt?.toISOString() ?? null,
    importedAt: book.importedAt?.toISOString() ?? null,
  }));

  return Response.json({ books: serializedBooks });
}
