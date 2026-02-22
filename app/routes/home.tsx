import { Link } from "react-router";
import { getBooks, getBooksCount, getRecentBooks, getUnmatchedBooksCount, getFormatCounts } from "../actions/books";
import { SeriesCard } from "../components/SeriesCard";
import { getSeriesWithCovers, type SeriesWithCovers } from "../actions/series";
import { BookGrid } from "../components/BookGrid";
import { SortDropdown, type SortOption } from "../components/SortDropdown";
import { TypeTabs, type TypeFilter } from "../components/TypeTabs";
import { FormatDropdown } from "../components/FormatDropdown";
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
  const view = url.searchParams.get("view");
  const seriesFilter = url.searchParams.get("series");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const sort = (url.searchParams.get("sort") as SortOption) || "recent";
  const typeParam = url.searchParams.get("type") as BookType | null;
  const type: TypeFilter = typeParam && ["audiobook", "ebook", "comic"].includes(typeParam) ? typeParam : "all";
  const formatParam = url.searchParams.get("format");
  const format = formatParam ? formatParam.split(",").filter(Boolean) : undefined;
  const offset = (page - 1) * BOOKS_PER_PAGE;
  const { orderBy, order } = getSortParams(sort);

  const typeFilter = type !== "all" ? type : undefined;

  // Series grid view
  if (view === "series") {
    const rawSeriesList = await getSeriesWithCovers();
    const seriesList = rawSeriesList.map(s => ({
      ...s,
      coverBooks: s.coverBooks.map(b => ({
        id: b.id,
        coverUrl: b.coverPath ? `/covers/${b.id}.jpg?v=${b.updatedAt?.getTime() || ""}` : null,
      })),
    }));
    return {
      view: "series" as const,
      seriesList,
      seriesFilter: null,
      books: [],
      totalCount: 0,
      recentBooks: [],
      unmatchedCount: 0,
      currentPage: 1,
      totalPages: 1,
      currentSort: sort,
      currentType: type,
      currentFormats: format ?? [],
      formatCounts: [],
    };
  }

  const [books, totalCount, recentBooks, unmatchedCount, formatCounts] = await Promise.all([
    getBooks({ limit: BOOKS_PER_PAGE, offset, orderBy, order, type: typeFilter, format, series: seriesFilter || undefined }),
    getBooksCount(typeFilter, format, seriesFilter || undefined),
    seriesFilter ? Promise.resolve([]) : getRecentBooks(5),
    getUnmatchedBooksCount(),
    getFormatCounts(typeFilter),
  ]);

  const totalPages = Math.ceil(totalCount / BOOKS_PER_PAGE);

  return {
    view: "books" as const,
    seriesList: [] as SeriesWithCovers[],
    seriesFilter,
    books,
    totalCount,
    recentBooks,
    unmatchedCount,
    currentPage: page,
    totalPages,
    currentSort: sort,
    currentType: type,
    currentFormats: format ?? [],
    formatCounts,
  };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function Pagination({
  currentPage,
  totalPages,
  currentSort,
  currentType,
  currentFormats,
}: {
  currentPage: number;
  totalPages: number;
  currentSort: SortOption;
  currentType: TypeFilter;
  currentFormats: string[];
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  const sortParam = currentSort !== "recent" ? `&sort=${currentSort}` : "";
  const typeParam = currentType !== "all" ? `&type=${currentType}` : "";
  const formatParam = currentFormats.length > 0 ? `&format=${currentFormats.join(",")}` : "";

  // Always show first page
  pages.push(1);

  // Show ellipsis if there's a gap after first page
  if (currentPage > 3) {
    pages.push("...");
  }

  // Show pages around current
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  // Show ellipsis if there's a gap before last page
  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  // Always show last page
  if (totalPages > 1 && !pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      {/* Previous button */}
      {currentPage > 1 ? (
        <Link
          to={`/?page=${currentPage - 1}${sortParam}${typeParam}${formatParam}`}
          className="px-3 py-2 rounded-lg border border-border hover:bg-surface-elevated text-foreground transition-colors"
        >
          &larr; Prev
        </Link>
      ) : (
        <span className="px-3 py-2 rounded-lg border border-border text-foreground-muted opacity-50">
          &larr; Prev
        </span>
      )}

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pages.map((page, index) =>
          page === "..." ? (
            <span key={`ellipsis-${index}`} className="px-2 text-foreground-muted">
              ...
            </span>
          ) : (
            <Link
              key={page}
              to={`/?page=${page}${sortParam}${typeParam}${formatParam}`}
              className={`px-3 py-2 rounded-lg border transition-colors ${
                page === currentPage
                  ? "bg-primary text-white border-primary"
                  : "border-border hover:bg-surface-elevated text-foreground"
              }`}
            >
              {page}
            </Link>
          ),
        )}
      </div>

      {/* Next button */}
      {currentPage < totalPages ? (
        <Link
          to={`/?page=${currentPage + 1}${sortParam}${typeParam}${formatParam}`}
          className="px-3 py-2 rounded-lg border border-border hover:bg-surface-elevated text-foreground transition-colors"
        >
          Next &rarr;
        </Link>
      ) : (
        <span className="px-3 py-2 rounded-lg border border-border text-foreground-muted opacity-50">
          Next &rarr;
        </span>
      )}
    </div>
  );
}

export default function Home({ loaderData }: { loaderData: LoaderData }) {
  const { view, seriesList, seriesFilter, books, totalCount, recentBooks, unmatchedCount, currentPage, totalPages, currentSort, currentType, currentFormats, formatCounts } =
    loaderData;

  return (
    <main className="container my-8 px-6 mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {seriesFilter ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Link to="/?view=series" className="text-sm text-primary hover:text-primary-hover transition-colors">
                    &larr; All Series
                  </Link>
                </div>
                <h1 className="text-2xl font-bold text-foreground">{seriesFilter}</h1>
                <p className="text-foreground-muted">
                  {totalCount} {totalCount === 1 ? "book" : "books"} in series
                  {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-foreground">Library</h1>
                <p className="text-foreground-muted">
                  {view === "series"
                    ? `${seriesList.length} ${seriesList.length === 1 ? "series" : "series"}`
                    : <>
                        {totalCount} {totalCount === 1 ? "book" : "books"}
                        {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
                      </>
                  }
                </p>
              </>
            )}
          </div>
          {!seriesFilter && unmatchedCount > 0 && (
            <Link
              to="/unmatched"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-light text-warning hover:opacity-80 transition-opacity text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="font-medium">{unmatchedCount}</span>
            </Link>
          )}
        </div>
        {!seriesFilter && (
          <div className="flex flex-wrap items-center gap-3">
            {/* View mode toggle */}
            <div className="inline-flex gap-1 p-1 bg-surface-elevated rounded-lg">
              <Link
                to={`/?${currentType !== "all" ? `type=${currentType}&` : ""}${currentSort !== "recent" ? `sort=${currentSort}` : ""}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  view !== "series"
                    ? "bg-primary text-white shadow-sm"
                    : "text-foreground-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Books
              </Link>
              <Link
                to="/?view=series"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  view === "series"
                    ? "bg-primary text-white shadow-sm"
                    : "text-foreground-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Series
              </Link>
            </div>
            {view !== "series" && (
              <>
                <TypeTabs currentType={currentType} currentSort={currentSort} />
                {formatCounts.length > 1 && (
                  <FormatDropdown
                    formatCounts={formatCounts}
                    selectedFormats={currentFormats}
                    currentType={currentType}
                    currentSort={currentSort}
                  />
                )}
                <div className="ml-auto">
                  <SortDropdown currentSort={currentSort} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Series grid view */}
      {view === "series" ? (
        <section>
          {seriesList.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-elevated flex items-center justify-center">
                <svg className="w-8 h-8 text-foreground-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-foreground-muted">No series found in your library.</p>
              <p className="text-foreground-muted/60 text-sm mt-1">Books with series metadata will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {seriesList.map((series) => (
                <SeriesCard
                  key={series.name}
                  name={series.name}
                  bookCount={series.bookCount}
                  coverBooks={series.coverBooks}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Recently read - only show on first page and not filtering by series */}
          {currentPage === 1 && recentBooks.length > 0 && !seriesFilter && (
            <section className="mb-10">
              <h2 className="text-lg font-semibold mb-4 text-foreground">Continue Reading</h2>
              <BookGrid books={recentBooks} size="compact" />
            </section>
          )}

          {/* Books grid */}
          <section>
            <BookGrid
              books={books}
              emptyMessage={seriesFilter ? "No books found in this series." : "Your library is empty. Drop some books above to get started!"}
            />
            <Pagination currentPage={currentPage} totalPages={totalPages} currentSort={currentSort} currentType={currentType} currentFormats={currentFormats} />
          </section>
        </>
      )}
    </main>
  );
}
