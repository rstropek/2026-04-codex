import { createDb } from "./client.js";
import { applyMigrations } from "./migrate.js";

const url = process.env.DATABASE_URL ?? "./local.db";
const { db, sqlite } = createDb(url);
applyMigrations(db);
sqlite.close();
console.log(`Migrations applied to ${url}`);
