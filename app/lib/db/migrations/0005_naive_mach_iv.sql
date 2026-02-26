CREATE TABLE `book_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`edit_group_id` text NOT NULL,
	`field` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`source` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_book_edits_book_id` ON `book_edits` (`book_id`);--> statement-breakpoint
CREATE INDEX `idx_book_edits_group` ON `book_edits` (`edit_group_id`);--> statement-breakpoint
CREATE INDEX `idx_book_edits_created_at` ON `book_edits` (`created_at`);