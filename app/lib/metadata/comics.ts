/**
 * Metron Comic Book Database API integration
 * https://metron.cloud/
 *
 * Requires METRON_USERNAME and METRON_PASSWORD environment variables
 */

import type { MetadataSearchResult } from "./index";

const METRON_API_BASE = "https://metron.cloud/api";

// Rate limiting: 30 requests/minute, 10,000/day
// We'll implement basic client-side throttling
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests (30/min)

interface MetronPublisher {
  id: number;
  name: string;
}

interface MetronSeries {
  id: number;
  name: string;
  sort_name: string;
  volume: number;
  series_type: { id: number; name: string };
  publisher: MetronPublisher;
  year_began: number;
  year_end: number | null;
  desc: string;
  issue_count: number;
  image: string | null;
  modified: string;
}

interface MetronIssue {
  id: number;
  publisher?: MetronPublisher;
  series: {
    id?: number;
    name: string;
    volume: number;
    year_began: number;
  };
  number: string;
  issue?: string; // List endpoint uses "issue" instead of "issue_name"
  issue_name?: string;
  cover_date: string;
  store_date: string | null;
  price?: string | null;
  sku?: string | null;
  isbn?: string | null;
  upc?: string | null;
  page_count?: number | null;
  desc?: string;
  image: string | null;
  // These fields are only present when fetching single issue details
  arcs?: Array<{ id: number; name: string }>;
  credits?: Array<{
    id: number;
    creator: string;
    role: Array<{ id: number; name: string }>;
  }>;
  characters?: Array<{ id: number; name: string }>;
  teams?: Array<{ id: number; name: string }>;
  modified: string;
}

interface MetronSearchResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Check if Metron credentials are configured
 */
export function isMetronConfigured(): boolean {
  return !!(process.env.METRON_USERNAME && process.env.METRON_PASSWORD);
}

/**
 * Get Basic Auth header for Metron API
 */
function getAuthHeader(): string {
  const username = process.env.METRON_USERNAME;
  const password = process.env.METRON_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Metron credentials not configured. Set METRON_USERNAME and METRON_PASSWORD environment variables.",
    );
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${credentials}`;
}

/**
 * Make a rate-limited request to the Metron API
 */
async function metronFetch<T>(
  endpoint: string,
  params?: Record<string, string>,
): Promise<T> {
  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest),
    );
  }
  lastRequestTime = Date.now();

  const url = new URL(`${METRON_API_BASE}/${endpoint}/`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: getAuthHeader(),
      "User-Agent": "Compendus/1.0",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    throw new Error(
      `Metron rate limit exceeded. Retry after ${retryAfter || "unknown"} seconds.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Metron API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Search for comic issues by name/title
 */
export async function searchMetronIssues(
  query: string,
): Promise<MetadataSearchResult[]> {
  if (!isMetronConfigured()) {
    return [];
  }

  try {
    const data = await metronFetch<MetronSearchResponse<MetronIssue>>("issue", {
      name: query,
    });

    return data.results.map(issueToMetadataResult);
  } catch (error) {
    console.error("Metron issue search error:", error);
    return [];
  }
}

/**
 * Search for comic series by name
 */
export async function searchMetronSeries(
  query: string,
): Promise<MetadataSearchResult[]> {
  if (!isMetronConfigured()) {
    return [];
  }

  try {
    const data = await metronFetch<MetronSearchResponse<MetronSeries>>(
      "series",
      {
        name: query,
      },
    );

    return data.results.map(seriesToMetadataResult);
  } catch (error) {
    console.error("Metron series search error:", error);
    return [];
  }
}

/**
 * Get a specific issue by ID
 */
export async function getMetronIssue(
  issueId: number,
): Promise<MetadataSearchResult | null> {
  if (!isMetronConfigured()) {
    return null;
  }

  try {
    const issue = await metronFetch<MetronIssue>(`issue/${issueId}`);
    return issueToMetadataResult(issue);
  } catch (error) {
    console.error("Metron issue fetch error:", error);
    return null;
  }
}

/**
 * Get issues for a series
 */
export async function getMetronSeriesIssues(
  seriesId: number,
): Promise<MetadataSearchResult[]> {
  if (!isMetronConfigured()) {
    return [];
  }

  try {
    const data = await metronFetch<MetronSearchResponse<MetronIssue>>("issue", {
      series_id: seriesId.toString(),
    });

    return data.results.map(issueToMetadataResult);
  } catch (error) {
    console.error("Metron series issues error:", error);
    return [];
  }
}

/**
 * Search for comics - tries issue search first, then series
 */
export async function searchMetronComics(
  query: string,
): Promise<MetadataSearchResult[]> {
  if (!isMetronConfigured()) {
    return [];
  }

  try {
    // Search issues and series in parallel
    const [issueResults, seriesResults] = await Promise.allSettled([
      searchMetronIssues(query),
      searchMetronSeries(query),
    ]);

    const issues =
      issueResults.status === "fulfilled" ? issueResults.value : [];
    const series =
      seriesResults.status === "fulfilled" ? seriesResults.value : [];

    // Interleave results, prioritizing issues
    const combined: MetadataSearchResult[] = [];
    const maxLen = Math.max(issues.length, series.length);

    for (let i = 0; i < maxLen; i++) {
      if (i < issues.length) {
        combined.push(issues[i]);
      }
      if (i < series.length) {
        combined.push(series[i]);
      }
    }

    return combined.slice(0, 20);
  } catch (error) {
    console.error("Metron search error:", error);
    return [];
  }
}

/**
 * Convert Metron issue to MetadataSearchResult
 */
function issueToMetadataResult(issue: MetronIssue): MetadataSearchResult {
  // Build title from series name and issue number
  // List endpoint uses "issue" field, detail endpoint uses "issue_name"
  const issueName = issue.issue_name || issue.issue;
  const title = issueName
    ? `${issue.series.name} #${issue.number}: ${issueName}`
    : `${issue.series.name} #${issue.number}`;

  // Extract creators by role (only available in detail view)
  const credits = issue.credits || [];
  const writers = credits
    .filter((c) => c.role.some((r) => r.name.toLowerCase().includes("writer")))
    .map((c) => c.creator);
  const artists = credits
    .filter((c) =>
      c.role.some((r) =>
        ["artist", "penciller", "penciler", "inker", "cover"].some((role) =>
          r.name.toLowerCase().includes(role),
        ),
      ),
    )
    .map((c) => c.creator);

  // Combine writers and artists as "authors"
  const authors = [...new Set([...writers, ...artists])];

  // Build cover URLs
  const coverUrls: string[] = [];
  if (issue.image) {
    coverUrls.push(issue.image);
  }

  // Build subjects from arcs and characters (only available in detail view)
  const arcs = issue.arcs || [];
  const characters = issue.characters || [];
  const subjects = [
    ...arcs.map((a) => a.name),
    ...characters.slice(0, 5).map((c) => c.name),
  ];

  return {
    title,
    subtitle: issueName || null,
    authors,
    publisher: issue.publisher?.name || null,
    publishedDate: issue.cover_date || issue.store_date || null,
    description: issue.desc || null,
    pageCount: issue.page_count ?? null,
    isbn: issue.isbn ?? null,
    isbn13: issue.isbn?.length === 13 ? issue.isbn : null,
    isbn10: issue.isbn?.length === 10 ? issue.isbn : null,
    language: null,
    subjects,
    series: issue.series.name,
    seriesNumber: issue.number,
    coverUrl: issue.image,
    coverUrlHQ: issue.image, // Metron provides full-size images
    coverUrls,
    source: "metron" as const,
    sourceId: `issue:${issue.id}`,
  };
}

/**
 * Convert Metron series to MetadataSearchResult
 */
function seriesToMetadataResult(series: MetronSeries): MetadataSearchResult {
  const title =
    series.volume > 1 ? `${series.name} (Vol. ${series.volume})` : series.name;

  const coverUrls: string[] = [];
  if (series.image) {
    coverUrls.push(series.image);
  }

  return {
    title,
    subtitle: series.series_type.name,
    authors: [],
    publisher: series.publisher.name,
    publishedDate: series.year_began.toString(),
    description: series.desc || null,
    pageCount: null,
    isbn: null,
    isbn13: null,
    isbn10: null,
    language: null,
    subjects: [],
    series: series.name,
    seriesNumber: null,
    coverUrl: series.image,
    coverUrlHQ: series.image,
    coverUrls,
    source: "metron" as const,
    sourceId: `series:${series.id}`,
  };
}
