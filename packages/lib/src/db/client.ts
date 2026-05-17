import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type QuestionnaireDb = ReturnType<typeof drizzle<typeof schema>>;

export interface CreatedDb {
  db: QuestionnaireDb;
  sqlite: Database.Database;
}

export function createDb(url: string): CreatedDb {
  const sqlite = new Database(url);
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
