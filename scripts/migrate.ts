import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";

const DB_PATH = resolve(process.cwd(), "data", "compendus.db");

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

console.log(`Database path: ${DB_PATH}`);

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

const db = drizzle(sqlite);

// Run Drizzle migrations
console.log("Running Drizzle migrations...");
migrate(db, { migrationsFolder: "./app/lib/db/migrations" });

// Create FTS5 virtual tables (not supported by Drizzle schema)
console.log("Setting up FTS5 full-text search tables...");

// Check if books_fts needs to be recreated with subtitle column
const ftsInfo = sqlite.prepare("PRAGMA table_info(books_fts)").all() as Array<{ name: string }>;
const hasSubtitle = ftsInfo.some((col) => col.name === "subtitle");

if (!hasSubtitle && ftsInfo.length > 0) {
  console.log("Recreating books_fts table to add subtitle column...");
  sqlite.exec(`DROP TABLE IF EXISTS books_fts`);
}

sqlite.exec(`
  -- Full-text search virtual table for book metadata
  CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
    book_id UNINDEXED,
    title,
    subtitle,
    authors,
    description,
    tokenize='porter unicode61 remove_diacritics 2'
  );

  -- Full-text search virtual table for book content
  CREATE VIRTUAL TABLE IF NOT EXISTS book_content_fts USING fts5(
    book_id UNINDEXED,
    chapter_index UNINDEXED,
    chapter_title,
    content,
    tokenize='porter unicode61 remove_diacritics 2'
  );
`);

// Sync books_fts with books table (add any missing entries)
console.log("Syncing FTS index with books table...");
const missingBooks = sqlite
  .prepare(
    `SELECT b.id, b.title, b.subtitle, b.authors, b.description
     FROM books b
     LEFT JOIN books_fts f ON b.id = f.book_id
     WHERE f.book_id IS NULL`,
  )
  .all() as Array<{
  id: string;
  title: string;
  subtitle: string | null;
  authors: string | null;
  description: string | null;
}>;

if (missingBooks.length > 0) {
  console.log(`  Found ${missingBooks.length} books not in FTS index, adding...`);
  const insertFts = sqlite.prepare(
    `INSERT INTO books_fts (book_id, title, subtitle, authors, description)
     VALUES (?, ?, ?, ?, ?)`,
  );

  for (const book of missingBooks) {
    insertFts.run(book.id, book.title, book.subtitle || "", book.authors || "", book.description || "");
  }
  console.log(`  Added ${missingBooks.length} books to FTS index`);
} else {
  console.log("  FTS index is in sync with books table");
}

// Add new columns (safe to run multiple times)
console.log("Adding new columns...");
const columnsToAdd = [
  { name: "isbn10", type: "TEXT" },
  { name: "series", type: "TEXT" },
  { name: "series_number", type: "TEXT" },
];

for (const col of columnsToAdd) {
  try {
    sqlite.exec(`ALTER TABLE books ADD COLUMN ${col.name} ${col.type}`);
    console.log(`  Added column: ${col.name}`);
  } catch (e: unknown) {
    // Column already exists - this is fine
    if (e instanceof Error && e.message.includes("duplicate column")) {
      console.log(`  Column ${col.name} already exists`);
    } else {
      throw e;
    }
  }
}

console.log("Migration completed successfully!");
sqlite.close();
