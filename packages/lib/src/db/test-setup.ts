import { type CreatedDb, createDb } from "./client.js";
import { applyMigrations } from "./migrate.js";

export function createTestDb(): CreatedDb {
  const created = createDb(":memory:");
  applyMigrations(created.db);
  return created;
}
