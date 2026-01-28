import type { AudioContent } from "../types";
import type { AudioChapter, BookFormat } from "../../types";

/**
 * Parse audio file into normalized content for the reader
 *
 * Audio metadata (duration, chapters) is already extracted during import
 * and stored in the database, so we just need to structure it for the reader.
 */
export async function parseAudio(
  bookId: string,
  format: BookFormat,
  duration: number,
  chaptersJson?: string | null,
): Promise<AudioContent> {
  // Parse chapters from JSON if available
  let chapters: AudioChapter[] = [];

  if (chaptersJson) {
    try {
      chapters = JSON.parse(chaptersJson);
    } catch {
      chapters = [];
    }
  }

  // If no chapters, create a single chapter spanning the whole file
  if (chapters.length === 0 && duration > 0) {
    chapters = [
      {
        index: 0,
        title: "Full Audio",
        startTime: 0,
        endTime: duration,
      },
    ];
  }

  // Ensure chapters are sorted by start time
  chapters.sort((a, b) => a.startTime - b.startTime);

  // Validate and fix chapter boundaries
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];

    // Ensure index is correct
    chapter.index = i;

    // If endTime is missing or invalid, calculate from next chapter or duration
    if (!chapter.endTime || chapter.endTime <= chapter.startTime) {
      if (i < chapters.length - 1) {
        chapter.endTime = chapters[i + 1].startTime;
      } else {
        chapter.endTime = duration;
      }
    }
  }

  return {
    bookId,
    format: format as "m4b" | "m4a" | "mp3",
    type: "audio",
    duration,
    chapters,
  };
}
