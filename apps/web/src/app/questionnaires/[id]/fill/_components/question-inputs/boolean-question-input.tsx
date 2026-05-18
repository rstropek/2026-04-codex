import type { Question } from "@questionnaires/lib";
import styles from "../../page.module.css";

type BooleanQuestion = Extract<Question, { type: "boolean" }>;

export function BooleanQuestionInput({
  question,
  name,
}: {
  question: BooleanQuestion;
  name: string;
}) {
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
      <div className={styles.radioRow}>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name={name}
            value="true"
            required={question.required}
          />
          Yes
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name={name}
            value="false"
            required={question.required}
          />
          No
        </label>
      </div>
    </fieldset>
  );
}
