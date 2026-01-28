import type { ComicContent, ComicPage } from "../types";
import type { BookFormat } from "../../types";

/**
 * Check if a filename is an image
 */
function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop();
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext || "");
}

/**
 * Natural sort comparator for filenames (handles page01.jpg, page2.jpg correctly)
 */
function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Parse CBZ (ZIP) file into normalized content
 */
async function parseCbz(buffer: Buffer, bookId: string): Promise<ComicContent> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  // Get all image files, sorted naturally
  const imageFiles = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir && isImageFile(name))
    .sort(naturalSort);

  const pages: ComicPage[] = imageFiles.map((name, index) => {
    const ext = name.toLowerCase().split(".").pop();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
    };

    return {
      index,
      name,
      mimeType: mimeTypes[ext || ""] || "image/jpeg",
    };
  });

  return {
    bookId,
    format: "cbz",
    type: "comic",
    pageCount: pages.length,
    pages,
  };
}

/**
 * Parse CBR (RAR) file into normalized content
 */
async function parseCbr(buffer: Buffer, bookId: string): Promise<ComicContent> {
  const { createExtractorFromData } = await import("node-unrar-js");

  // Convert Buffer to ArrayBuffer for node-unrar-js
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const extractor = await createExtractorFromData({ data: arrayBuffer as ArrayBuffer });
  const list = extractor.getFileList();
  const fileHeaders = [...list.fileHeaders];

  // Get all image files, sorted naturally
  const imageFiles = fileHeaders
    .filter((header) => !header.flags.directory && isImageFile(header.name))
    .sort((a, b) => naturalSort(a.name, b.name));

  const pages: ComicPage[] = imageFiles.map((header, index) => {
    const ext = header.name.toLowerCase().split(".").pop();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
    };

    return {
      index,
      name: header.name,
      mimeType: mimeTypes[ext || ""] || "image/jpeg",
    };
  });

  return {
    bookId,
    format: "cbr",
    type: "comic",
    pageCount: pages.length,
    pages,
  };
}

/**
 * Parse comic archive into normalized content for the reader
 */
export async function parseComic(
  buffer: Buffer,
  bookId: string,
  format: BookFormat,
): Promise<ComicContent> {
  try {
    if (format === "cbz") {
      return await parseCbz(buffer, bookId);
    } else if (format === "cbr") {
      return await parseCbr(buffer, bookId);
    }

    // Fallback for unknown format
    return {
      bookId,
      format: format as "cbr" | "cbz",
      type: "comic",
      pageCount: 0,
      pages: [],
    };
  } catch {
    return {
      bookId,
      format: format as "cbr" | "cbz",
      type: "comic",
      pageCount: 0,
      pages: [],
    };
  }
}
