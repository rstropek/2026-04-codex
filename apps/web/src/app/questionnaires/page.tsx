import { listQuestionnaires } from "@questionnaires/lib";
import Link from "next/link";
import { getDb } from "../../server/db";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function QuestionnairesPage() {
  const { db } = getDb();
  const all = listQuestionnaires(db);
  const items = all.filter((q) => q.currentVersion !== null);

  return (
    <section className={pageStyles.page}>
      <p className={pageStyles.eyebrow}>Section</p>
      <h1 className={pageStyles.title}>Questionnaires</h1>

      {items.length === 0 ? (
        <p className={styles.empty}>No questionnaires yet.</p>
      ) : (
        <ul className={styles.grid}>
          {items.map((q) => (
            <li key={q.id} className={styles.card}>
              <h2 className={styles.cardTitle}>{q.title}</h2>
              <div className={styles.meta}>
                <span>v{q.currentVersion}</span>
                <span>{formatDate(q.createdAt)}</span>
              </div>
              <div className={styles.actions}>
                <Link
                  href={`/questionnaires/${q.id}/results`}
                  className={styles.action}
                >
                  Results
                </Link>
                <Link
                  href={`/questionnaires/${q.id}/fill`}
                  className={`${styles.action} ${styles.actionPrimary}`}
                >
                  Fill out
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
