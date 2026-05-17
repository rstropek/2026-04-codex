import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { QuestionnaireDb } from "./client.js";

const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "migrations",
);

export function applyMigrations(db: QuestionnaireDb): void {
  migrate(db, { migrationsFolder });
}
