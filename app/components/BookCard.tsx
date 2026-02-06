import { Link } from "react-router";
import type { Book } from "../lib/db/schema";
import { AuthorLinks } from "./AuthorLink";
import { getBookType, type BookType } from "../lib/book-types";

interface BookCardProps {
  book: Book;
}

function TypeIcon({ type }: { type: BookType }) {
  if (type === "audiobook") {
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 012.828-2.828"
        />
        <circle cx="12" cy="17" r="1.5" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15.5V9" />
      </svg>
    );
  }
  return null;
}

function getBadgeStyles(type: BookType): string {
  if (type === "audiobook") {
    return "bg-accent-light text-accent";
  }
  return "bg-primary-light text-primary";
}

export function BookCard({ book }: BookCardProps) {
  const authors = book.authors ? JSON.parse(book.authors) : [];
  const progressPercent = Math.round((book.readingProgress || 0) * 100);
  const bookType = getBookType(book.format);

  return (
    <Link
      to={`/book/${book.id}`}
      className="group block bg-surface border border-border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30"
    >
      {/* Cover */}
      <div
        className="aspect-[2/3] w-full overflow-hidden bg-surface-elevated"
        style={{ backgroundColor: book.coverColor || undefined }}
      >
        {book.coverPath ? (
          <img
            src={`/covers/${book.id}.jpg`}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-primary-light to-accent-light">
            <span className="text-center text-foreground-muted text-sm font-medium line-clamp-4">
              {book.title}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1 text-foreground">{book.title}</h3>
        {authors.length > 0 && (
          <p className="text-xs text-foreground-muted line-clamp-1">
            <AuthorLinks authors={authors} asSpan />
          </p>
        )}

        {/* Progress bar */}
        {progressPercent > 0 && (
          <div className="mt-3">
            <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-foreground-muted mt-1.5">{progressPercent}%</p>
          </div>
        )}

        {/* Format badge */}
        <div className="mt-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full uppercase tracking-wide ${getBadgeStyles(bookType)}`}>
            <TypeIcon type={bookType} />
            {book.format}
          </span>
        </div>
      </div>
    </Link>
  );
}
