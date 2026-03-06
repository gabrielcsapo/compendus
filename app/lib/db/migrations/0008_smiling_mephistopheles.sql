CREATE INDEX `idx_books_isbn` ON `books` (`isbn`);--> statement-breakpoint
CREATE INDEX `idx_books_isbn13` ON `books` (`isbn13`);--> statement-breakpoint
CREATE INDEX `idx_books_isbn10` ON `books` (`isbn10`);--> statement-breakpoint
CREATE INDEX `idx_books_series` ON `books` (`series`);