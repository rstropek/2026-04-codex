import type { Question } from "@questionnaires/lib";
import styles from "../../page.module.css";

type LikertQuestion = Extract<Question, { type: "likert" }>;

export function LikertQuestionInput({
  question,
  name,
}: {
  question: LikertQuestion;
  name: string;
}) {
  const values = Array.from({ length: question.likertMax }, (_, i) => i + 1);
  return (
    <fieldset className={styles.field}>
      <legend className={styles.prompt}>
        {question.prompt}
        {question.required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </legend>
      <div className={styles.likertScale}>
        <span className={styles.likertEnds}>{question.lowLabel}</span>
        <div className={styles.likertOptions} role="radiogroup">
          {values.map((v) => (
            <label key={v} className={styles.likertOption}>
              <input
                type="radio"
                name={name}
                value={String(v)}
                required={question.required}
                aria-label={String(v)}
              />
              <span>{v}</span>
            </label>
          ))}
        </div>
        <span className={`${styles.likertEnds} ${styles.likertEndsRight}`}>
          {question.highLabel}
        </span>
      </div>
    </fieldset>
  );
}
