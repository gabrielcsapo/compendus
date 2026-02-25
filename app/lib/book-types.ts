export type BookType = "audiobook" | "ebook" | "comic";

const AUDIOBOOK_FORMATS = ["m4b", "mp3", "m4a"];
const COMIC_FORMATS = ["cbr", "cbz"];
const EBOOK_FORMATS = ["pdf", "epub", "mobi", "azw3"];

/** Formats that can be read directly without conversion */
const NATIVE_FORMATS = ["pdf", "epub", "cbz", "m4b", "mp3", "m4a"];

/** Formats that need conversion before reading, mapped to their target format */
const CONVERTIBLE_FORMAT_MAP: Record<string, string> = {
  mobi: "epub",
  azw: "epub",
  azw3: "epub",
  cbr: "cbz",
};

export function isNativeFormat(format: string): boolean {
  return NATIVE_FORMATS.includes(format.toLowerCase());
}

export function isConvertibleFormat(format: string): boolean {
  return format.toLowerCase() in CONVERTIBLE_FORMAT_MAP;
}

export function getConversionTarget(format: string): string | null {
  return CONVERTIBLE_FORMAT_MAP[format.toLowerCase()] ?? null;
}

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
function isValidBookType(value: string): value is BookType {
  return value === "audiobook" || value === "ebook" || value === "comic";
}
