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

export function getBookType(format: string): BookType {
  if (AUDIOBOOK_FORMATS.includes(format)) return "audiobook";
  if (COMIC_FORMATS.includes(format)) return "comic";
  return "ebook";
}
