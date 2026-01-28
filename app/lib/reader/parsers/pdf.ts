import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfContent, TocEntry } from "../types";

/**
 * Parse PDF file into normalized content for the reader
 *
 * Uses pdfjs-dist to get accurate page count and outline
 */
export async function parsePdf(buffer: Buffer, bookId: string): Promise<PdfContent> {
  try {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;

    // Try to extract TOC from PDF outline
    const toc = await extractPdfToc(pdfDoc);

    // Clean up
    await pdfDoc.destroy();

    return {
      bookId,
      format: "pdf",
      type: "pdf",
      pageCount,
      toc,
    };
  } catch (error) {
    console.error("PDF parse error:", error);
    // If parsing fails, return minimal content
    return {
      bookId,
      format: "pdf",
      type: "pdf",
      pageCount: 1,
      toc: [],
    };
  }
}

/**
 * Extract table of contents from PDF outline
 */
async function extractPdfToc(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<TocEntry[]> {
  try {
    const outline = await pdfDoc.getOutline();
    if (!outline) return [];

    const numPages = pdfDoc.numPages;

    async function processOutlineItems(
      items: Array<{ title: string; dest: unknown; items?: unknown[] }>,
      level = 0,
    ): Promise<TocEntry[]> {
      const entries: TocEntry[] = [];

      for (const item of items) {
        let position = 0;

        // Try to get page number from destination
        if (item.dest) {
          try {
            const dest = typeof item.dest === "string"
              ? await pdfDoc.getDestination(item.dest)
              : item.dest;

            if (dest && Array.isArray(dest) && dest[0]) {
              const pageRef = dest[0] as { num: number; gen: number };
              const pageIndex = await pdfDoc.getPageIndex(pageRef);
              position = pageIndex / Math.max(1, numPages - 1);
            }
          } catch {
            // Ignore destination resolution errors
          }
        }

        const entry: TocEntry = {
          title: item.title,
          position,
          level,
        };

        if (item.items && item.items.length > 0) {
          entry.children = await processOutlineItems(
            item.items as Array<{ title: string; dest: unknown; items?: unknown[] }>,
            level + 1,
          );
        }

        entries.push(entry);
      }

      return entries;
    }

    return processOutlineItems(
      outline as Array<{ title: string; dest: unknown; items?: unknown[] }>,
    );
  } catch {
    return [];
  }
}
