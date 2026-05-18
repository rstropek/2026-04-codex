import type { TextQuestionResult } from "@questionnaires/lib";
import styles from "../page.module.css";

export function TextResult({ result }: { result: TextQuestionResult }) {
  const counts = new Map<string, number>();
  for (const answer of result.answers) {
    const key = answer.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className={styles.table}>
      <div className={`${styles.cell} ${styles.headCell}`}>Answer</div>
      <div className={`${styles.cell} ${styles.headCell} ${styles.cellRight}`}>
        Count
      </div>
      {rows.length === 0 ? (
        <>
          <div className={`${styles.cell} ${styles.empty}`}>No responses</div>
          <div className={`${styles.cell} ${styles.cellRight}`}>0</div>
        </>
      ) : (
        rows.map(([answer, count]) => (
          <div key={answer} style={{ display: "contents" }}>
            <div className={styles.cell}>{answer}</div>
            <div className={`${styles.cell} ${styles.cellRight}`}>{count}</div>
          </div>
        ))
      )}
      <div className={`${styles.cell} ${styles.empty}`}>(no answer)</div>
      <div className={`${styles.cell} ${styles.cellRight}`}>
        {result.emptyCount}
      </div>
    </div>
  );
}
