import type { LikertQuestionResult } from "@questionnaires/lib";
import styles from "../page.module.css";

export function LikertResult({ result }: { result: LikertQuestionResult }) {
  return (
    <div className={styles.table}>
      <div className={`${styles.cell} ${styles.headCell}`}>Rating</div>
      <div className={`${styles.cell} ${styles.headCell} ${styles.cellRight}`}>
        Count
      </div>
      {result.counts.map((count, idx) => {
        const value = idx + 1;
        let label = String(value);
        if (idx === 0) label += ` — ${result.lowLabel}`;
        else if (idx === result.counts.length - 1)
          label += ` — ${result.highLabel}`;
        return (
          <div key={value} style={{ display: "contents" }}>
            <div className={styles.cell}>{label}</div>
            <div className={`${styles.cell} ${styles.cellRight}`}>{count}</div>
          </div>
        );
      })}
      <div className={`${styles.cell} ${styles.empty}`}>(no answer)</div>
      <div className={`${styles.cell} ${styles.cellRight}`}>
        {result.emptyCount}
      </div>
    </div>
  );
}
