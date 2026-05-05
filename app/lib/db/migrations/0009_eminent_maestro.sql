CREATE TABLE `book_subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`subject` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_book_subjects_book_subject` ON `book_subjects` (`book_id`,`subject`);--> statement-breakpoint
CREATE INDEX `idx_book_subjects_subject` ON `book_subjects` (`subject`);--> statement-breakpoint
CREATE INDEX `idx_book_subjects_book` ON `book_subjects` (`book_id`);