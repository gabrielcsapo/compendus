export type BookType = "audiobook" | "ebook" | "comic";

const AUDIOBOOK_FORMATS = ["m4b", "mp3", "m4a"];
const COMIC_FORMATS = ["cbr", "cbz"];
const EBOOK_FORMATS = ["pdf", "epub", "mobi", "azw3"];

export function getFormatsByType(type: BookType): string[] {
  switch (type) {
    case "audiobook":
      return AUDIOBOOK_FORMATS;
    case "comic":
      return COMIC_FORMATS;
    case "ebook":
      return EBOOK_FORMATS;
  }
}

/**
 * Get the book type for a given format, with optional override
 * @param format - The file format (e.g., 'epub', 'pdf', 'cbz')
 * @param bookTypeOverride - Optional override to treat the book as a different type
 */
export function getBookType(format: string, bookTypeOverride?: string | null): BookType {
  // If an override is set, use it (after validating it's a valid BookType)
  if (bookTypeOverride && isValidBookType(bookTypeOverride)) {
    return bookTypeOverride;
  }
  // Otherwise, derive from format
  if (AUDIOBOOK_FORMATS.includes(format)) return "audiobook";
  if (COMIC_FORMATS.includes(format)) return "comic";
  return "ebook";
}

/**
 * Check if a string is a valid BookType
 */
export function isValidBookType(value: string): value is BookType {
  return value === "audiobook" || value === "ebook" || value === "comic";
}
