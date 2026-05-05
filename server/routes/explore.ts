import { Hono } from "hono";
import { getExploreData } from "../../app/actions/explore";
import { toApiBook } from "../../app/lib/api/search";

export const exploreRoutes = new Hono();

// GET /api/explore - server-driven explore view model for iOS
exploreRoutes.get("/api/explore", async (c) => {
  const profileId = c.get("profileId") ?? undefined;
  const baseUrl = new URL(c.req.url).origin;
  const data = await getExploreData(profileId);

  const sections: Array<{
    id: string;
    title: string;
    books: ReturnType<typeof toApiBook>[];
    action: { label: string } | null;
  }> = [];

  if (data.inProgress.length > 0) {
    sections.push({
      id: "continue_reading",
      title: "Continue Reading",
      books: data.inProgress.map((b) => toApiBook(b, baseUrl, b)),
      action: null,
    });
  }

  if (data.readNextInSeries.length > 0) {
    sections.push({
      id: "read_next_in_series",
      title: "Read Next in Series",
      books: data.readNextInSeries.map((r) => toApiBook(r.book, baseUrl, r.book)),
      action: null,
    });
  }

  if (data.staleReads.length > 0) {
    sections.push({
      id: "stale_reads",
      title: "Finish These?",
      books: data.staleReads.map((b) => toApiBook(b, baseUrl, b)),
      action: null,
    });
  }

  if (data.recentlyAdded.length > 0) {
    sections.push({
      id: "recently_added",
      title: "Recently Added",
      books: data.recentlyAdded.map((b) => toApiBook(b, baseUrl, b)),
      action: { label: "See All" },
    });
  }

  for (const authorGroup of data.moreByAuthor) {
    sections.push({
      id: `author_${authorGroup.author.replace(/\s+/g, "_").toLowerCase()}`,
      title: `More by ${authorGroup.author}`,
      books: authorGroup.books.map((b) => toApiBook(b, baseUrl, b)),
      action: null,
    });
  }

  for (const genre of data.genreSections) {
    const displayName = genre.subject.replace(/\b\w/g, (c) => c.toUpperCase());
    sections.push({
      id: `genre_${genre.subject.replace(/\s+/g, "_")}`,
      title: displayName,
      books: genre.books.map((b) => toApiBook(b, baseUrl, b)),
      action: null,
    });
  }

  for (const series of data.topSeries) {
    sections.push({
      id: `series_${series.name}`,
      title: series.name,
      books: series.books.map((b) => toApiBook(b, baseUrl, b)),
      action: { label: "See All" },
    });
  }

  for (const tag of data.topTags) {
    sections.push({
      id: `tag_${tag.id}`,
      title: tag.name.charAt(0).toUpperCase() + tag.name.slice(1),
      books: tag.books.map((b) => toApiBook(b, baseUrl, b)),
      action: null,
    });
  }

  return c.json({ sections });
});
