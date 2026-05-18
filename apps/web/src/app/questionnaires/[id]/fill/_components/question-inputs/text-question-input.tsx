import type { Question } from "@questionnaires/lib";
import styles from "../../page.module.css";

type TextQuestion = Extract<Question, { type: "text" }>;

export function TextQuestionInput({
  question,
  name,
}: {
  question: TextQuestion;
  name: string;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.prompt} htmlFor={`q-${name}`}>
        {question.prompt}
        {question.required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      <textarea
        id={`q-${name}`}
        name={name}
        className={styles.textarea}
        required={question.required}
        aria-required={question.required}
      />
    </div>
  );
}
