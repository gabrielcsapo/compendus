/**
 * Copy database migrations to dist/rsc directory
 * drizzle-orm migrator needs these files at runtime
 */
import { cp } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

async function copyMigrations() {
  const migrationsSrc = join(rootDir, "app/lib/db/migrations");
  const migrationsDest = join(rootDir, "dist/rsc/migrations");

  await cp(migrationsSrc, migrationsDest, { recursive: true });
  console.log("[Post Build] Copied migrations to dist/rsc/migrations/");
}

copyMigrations().catch((error) => {
  console.error("[Post Build] Failed to copy migrations:", error);
  process.exit(1);
});
