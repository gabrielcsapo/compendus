ALTER TABLE `books` DROP COLUMN `format`;--> statement-breakpoint
ALTER TABLE `books` ADD `format` text GENERATED ALWAYS AS (CASE
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
        END) VIRTUAL NOT NULL;