CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`position` text NOT NULL,
	`title` text,
	`note` text,
	`color` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bookmarks_book` ON `bookmarks` (`book_id`);--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`file_path` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`file_hash` text NOT NULL,
	`format` text GENERATED ALWAYS AS (CASE
          WHEN file_name LIKE '%.pdf' THEN 'pdf'
          WHEN file_name LIKE '%.epub' THEN 'epub'
          WHEN file_name LIKE '%.mobi' THEN 'mobi'
          WHEN file_name LIKE '%.azw3' THEN 'azw3'
          WHEN file_name LIKE '%.azw' THEN 'mobi'
          WHEN file_name LIKE '%.cbr' THEN 'cbr'
          WHEN file_name LIKE '%.cbz' THEN 'cbz'
          WHEN file_name LIKE '%.m4b' THEN 'm4b'
          WHEN file_name LIKE '%.mp3' THEN 'mp3'
          WHEN file_name LIKE '%.m4a' THEN 'm4a'
          ELSE 'unknown'
        END) VIRTUAL NOT NULL,
	`mime_type` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`authors` text,
	`publisher` text,
	`published_date` text,
	`description` text,
	`isbn` text,
	`isbn13` text,
	`isbn10` text,
	`language` text,
	`page_count` integer,
	`series` text,
	`series_number` text,
	`duration` integer,
	`narrator` text,
	`chapters` text,
	`cover_path` text,
	`cover_color` text,
	`match_skipped` integer DEFAULT false,
	`book_type_override` text,
	`reading_progress` real DEFAULT 0,
	`last_read_at` integer,
	`last_position` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`imported_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_books_title` ON `books` (`title`);--> statement-breakpoint
CREATE INDEX `idx_books_format` ON `books` (`format`);--> statement-breakpoint
CREATE INDEX `idx_books_created_at` ON `books` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_books_last_read_at` ON `books` (`last_read_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_books_file_hash` ON `books` (`file_hash`);--> statement-breakpoint
CREATE TABLE `books_collections` (
	`book_id` text NOT NULL,
	`collection_id` text NOT NULL,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bc_book` ON `books_collections` (`book_id`);--> statement-breakpoint
CREATE INDEX `idx_bc_collection` ON `books_collections` (`collection_id`);--> statement-breakpoint
CREATE TABLE `books_tags` (
	`book_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bt_book` ON `books_tags` (`book_id`);--> statement-breakpoint
CREATE INDEX `idx_bt_tag` ON `books_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`icon` text,
	`sort_order` integer DEFAULT 0,
	`parent_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_collections_parent` ON `collections` (`parent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_collections_name` ON `collections` (`name`);--> statement-breakpoint
CREATE TABLE `highlights` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`start_position` text NOT NULL,
	`end_position` text NOT NULL,
	`text` text NOT NULL,
	`note` text,
	`color` text DEFAULT '#ffff00',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_highlights_book` ON `highlights` (`book_id`);--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`pages_read` integer,
	`start_position` text,
	`end_position` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_book` ON `reading_sessions` (`book_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_started` ON `reading_sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tags_name` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `wanted_books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`authors` text,
	`publisher` text,
	`published_date` text,
	`description` text,
	`isbn` text,
	`isbn13` text,
	`isbn10` text,
	`language` text,
	`page_count` integer,
	`series` text,
	`series_number` text,
	`cover_url` text,
	`source` text NOT NULL,
	`source_id` text,
	`status` text DEFAULT 'wishlist' NOT NULL,
	`priority` integer DEFAULT 0,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_wanted_books_series` ON `wanted_books` (`series`);--> statement-breakpoint
CREATE INDEX `idx_wanted_books_status` ON `wanted_books` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_wanted_books_source` ON `wanted_books` (`source`,`source_id`);