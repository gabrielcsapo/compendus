import { fromBuffer } from "pdf2pic";
import { readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

// Cache directory for rendered pages
const CACHE_DIR = "data/pdf-cache";

// Ensure cache directory exists
async function ensureCacheDir(): Promise<void> {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true });
  }
}

/**
 * Render a PDF page to a PNG buffer using GraphicsMagick via pdf2pic
 */
export async function renderPdfPage(
  buffer: Buffer,
  bookId: string,
  pageNumber: number,
  scale = 2.0,
): Promise<Buffer> {
  await ensureCacheDir();

  // Check if page is already cached
  const cachePath = join(CACHE_DIR, `${bookId}-page-${pageNumber}.png`);
  if (existsSync(cachePath)) {
    return readFile(cachePath);
  }

  // Use pdf2pic with GraphicsMagick for high-quality rendering
  const converter = fromBuffer(buffer, {
    density: Math.round(150 * scale), // DPI - higher = better quality
    savePath: CACHE_DIR,
    saveFilename: `${bookId}-page`,
    format: "png",
    width: Math.round(800 * scale),
    height: Math.round(1200 * scale),
    preserveAspectRatio: true,
  });

  const result = await converter(pageNumber, { responseType: "buffer" });

  if (!result.buffer) {
    throw new Error(`Failed to render PDF page ${pageNumber}`);
  }

  return result.buffer;
}

/**
 * Clear cached PDF pages for a book
 */
export async function clearPdfCache(bookId: string): Promise<void> {
  await ensureCacheDir();

  const { readdir, unlink } = await import("fs/promises");
  try {
    const files = await readdir(CACHE_DIR);
    for (const file of files) {
      if (file.startsWith(`${bookId}-page`)) {
        await unlink(join(CACHE_DIR, file));
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}
