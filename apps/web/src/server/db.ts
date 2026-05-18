import {
  applyMigrations,
  createDb,
  type QuestionnaireDb,
} from "@questionnaires/lib";
import { cache } from "react";

function resolveDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Configure it in apps/web/.env.local (absolute path to the questionnaire.db file).",
    );
  }
  return url;
}

export const getDb = cache((): { db: QuestionnaireDb; url: string } => {
  const url = resolveDbUrl();
  const { db } = createDb(url);
  applyMigrations(db);
  return { db, url };
});
