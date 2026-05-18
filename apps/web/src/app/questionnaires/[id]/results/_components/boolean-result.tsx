import type { BooleanQuestionResult } from "@questionnaires/lib";
import styles from "../page.module.css";

export function BooleanResult({ result }: { result: BooleanQuestionResult }) {
  const rows: Array<[label: string, count: number, muted?: boolean]> = [
    ["Yes", result.trueCount],
    ["No", result.falseCount],
    ["(no answer)", result.emptyCount, true],
  ];
  return (
    <div className={styles.table}>
      <div className={`${styles.cell} ${styles.headCell}`}>Answer</div>
      <div className={`${styles.cell} ${styles.headCell} ${styles.cellRight}`}>
        Count
      </div>
      {rows.map(([label, count, muted]) => (
        <div key={label} style={{ display: "contents" }}>
          <div className={`${styles.cell} ${muted ? styles.empty : ""}`}>
            {label}
          </div>
          <div className={`${styles.cell} ${styles.cellRight}`}>{count}</div>
        </div>
      ))}
    </div>
  );
}
