import { createExtractorFromData } from "node-unrar-js";
import type { BookFormat } from "../types";

// Image extensions for comic book archives
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];

export interface ComicPage {
  index: number;
  name: string;
  data: Buffer;
  mimeType: string;
}

/**
 * Get the MIME type for an image file based on extension
 */
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    default:
      return "image/jpeg";
  }
}

/**
 * Check if a filename is an image
 */
function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Get sorted list of image file names from a CBZ file (without extracting data)
 * Returns empty array if the archive is corrupted
 */
async function getCbzImageFileList(buffer: Buffer): Promise<string[]> {
  try {
    console.log(`[CBZ] Parsing CBZ archive, buffer size: ${buffer.length} bytes`);
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);

    const allFiles = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    const imageFiles = allFiles.filter((name) => isImageFile(name));

    console.log(`[CBZ] Found ${allFiles.length} total files, ${imageFiles.length} images`);
    if (imageFiles.length === 0 && allFiles.length > 0) {
      console.log(`[CBZ] All files in archive:`, allFiles.slice(0, 10));
    }

    return imageFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch (error) {
    console.error("Error reading CBZ archive:", error);
    return [];
  }
}

/**
 * Extract a single page from a CBZ (ZIP) file
 */
export async function extractCbzPage(buffer: Buffer, pageIndex: number): Promise<ComicPage | null> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const imageFiles = Object.keys(zip.files)
      .filter((name) => !zip.files[name].dir && isImageFile(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (pageIndex < 0 || pageIndex >= imageFiles.length) {
      return null;
    }

    const fileName = imageFiles[pageIndex];
    const file = zip.files[fileName];
    const data = await file.async("nodebuffer");

    return {
      index: pageIndex,
      name: fileName,
      data,
      mimeType: getMimeType(fileName),
    };
  } catch (error) {
    console.error("Error extracting CBZ page:", error);
    return null;
  }
}

/**
 * Get page count from a CBZ file (without extracting data)
 */
export async function getCbzPageCount(buffer: Buffer): Promise<number> {
  const imageFiles = await getCbzImageFileList(buffer);
  return imageFiles.length;
}

/**
 * Extract all pages from a CBZ (ZIP) file
 */
export async function extractCbzPages(buffer: Buffer): Promise<ComicPage[]> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const imageFiles = Object.keys(zip.files)
      .filter((name) => !zip.files[name].dir && isImageFile(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const pages: ComicPage[] = [];
    for (let index = 0; index < imageFiles.length; index++) {
      const fileName = imageFiles[index];
      const file = zip.files[fileName];
      const data = await file.async("nodebuffer");

      pages.push({
        index,
        name: fileName,
        data,
        mimeType: getMimeType(fileName),
      });
    }

    return pages;
  } catch (error) {
    console.error("Error extracting CBZ pages:", error);
    return [];
  }
}

/**
 * Convert Buffer to ArrayBuffer for node-unrar-js
 */
function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

/**
 * Get sorted list of image file names from a CBR file (without extracting data)
 * Returns empty array if the archive is corrupted
 */
async function getCbrImageFileList(buffer: Buffer): Promise<string[]> {
  try {
    console.log(`[CBR] Parsing CBR archive, buffer size: ${buffer.length} bytes`);
    const extractor = await createExtractorFromData({ data: bufferToArrayBuffer(buffer) });
    const list = extractor.getFileList();

    const allFiles: string[] = [];
    const imageFiles: string[] = [];
    for (const fileHeader of list.fileHeaders) {
      allFiles.push(fileHeader.name);
      if (fileHeader.flags.directory) continue;
      if (!isImageFile(fileHeader.name)) continue;
      imageFiles.push(fileHeader.name);
    }

    console.log(`[CBR] Found ${allFiles.length} total files, ${imageFiles.length} images`);
    if (imageFiles.length === 0 && allFiles.length > 0) {
      console.log(`[CBR] All files in archive:`, allFiles.slice(0, 10));
    }

    return imageFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch (error) {
    console.error("Error reading CBR archive:", error);
    return [];
  }
}

/**
 * Extract a single page from a CBR (RAR) file
 */
export async function extractCbrPage(buffer: Buffer, pageIndex: number): Promise<ComicPage | null> {
  try {
    const imageFiles = await getCbrImageFileList(buffer);

    if (pageIndex < 0 || pageIndex >= imageFiles.length) {
      return null;
    }

    const targetFileName = imageFiles[pageIndex];

    // Extract only the specific file we need
    const extractor = await createExtractorFromData({ data: bufferToArrayBuffer(buffer) });
    const { files } = extractor.extract({ files: [targetFileName] });

    for (const file of files) {
      if (file.fileHeader.name === targetFileName && file.extraction) {
        return {
          index: pageIndex,
          name: file.fileHeader.name,
          data: Buffer.from(file.extraction),
          mimeType: getMimeType(file.fileHeader.name),
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting CBR page:", error);
    return null;
  }
}

/**
 * Get page count from a CBR file (without extracting data)
 */
export async function getCbrPageCount(buffer: Buffer): Promise<number> {
  const imageFiles = await getCbrImageFileList(buffer);
  return imageFiles.length;
}

/**
 * Extract all pages from a CBR (RAR) file
 */
export async function extractCbrPages(buffer: Buffer): Promise<ComicPage[]> {
  try {
    const extractor = await createExtractorFromData({ data: bufferToArrayBuffer(buffer) });
    const { files } = extractor.extract();

    const pages: ComicPage[] = [];

    // Collect all image files
    for (const file of files) {
      if (file.fileHeader.flags.directory) continue;
      if (!isImageFile(file.fileHeader.name)) continue;

      pages.push({
        index: 0, // Will be set after sorting
        name: file.fileHeader.name,
        data: Buffer.from(file.extraction!),
        mimeType: getMimeType(file.fileHeader.name),
      });
    }

    // Sort alphabetically and update indices
    pages.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    pages.forEach((page, index) => {
      page.index = index;
    });

    return pages;
  } catch (error) {
    console.error("Error extracting CBR pages:", error);
    return [];
  }
}

/**
 * Extract pages from a comic book archive (CBZ or CBR)
 */
export async function extractComicPages(buffer: Buffer, format: BookFormat): Promise<ComicPage[]> {
  switch (format) {
    case "cbz":
      return extractCbzPages(buffer);
    case "cbr":
      return extractCbrPages(buffer);
    default:
      throw new Error(`Not a comic book format: ${format}`);
  }
}

/**
 * Get a single page from a comic book archive (optimized - only extracts the requested page)
 */
export async function getComicPage(
  buffer: Buffer,
  format: BookFormat,
  pageIndex: number,
): Promise<ComicPage | null> {
  switch (format) {
    case "cbz":
      return extractCbzPage(buffer, pageIndex);
    case "cbr":
      return extractCbrPage(buffer, pageIndex);
    default:
      throw new Error(`Not a comic book format: ${format}`);
  }
}

/**
 * Get the total number of pages in a comic book archive (optimized - doesn't extract image data)
 */
export async function getComicPageCount(buffer: Buffer, format: BookFormat): Promise<number> {
  switch (format) {
    case "cbz":
      return getCbzPageCount(buffer);
    case "cbr":
      return getCbrPageCount(buffer);
    default:
      throw new Error(`Not a comic book format: ${format}`);
  }
}
