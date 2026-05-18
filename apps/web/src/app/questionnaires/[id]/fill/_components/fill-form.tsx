import type { Question } from "@questionnaires/lib";
import { submitAnswersAction } from "../actions";
import styles from "../page.module.css";
import { BooleanQuestionInput } from "./question-inputs/boolean-question-input";
import { LikertQuestionInput } from "./question-inputs/likert-question-input";
import { TextQuestionInput } from "./question-inputs/text-question-input";

export function FillForm({
  questionnaireId,
  versionNumber,
  questions,
}: {
  questionnaireId: number;
  versionNumber: number;
  questions: Question[];
}) {
  return (
    <form action={submitAnswersAction} className={styles.form}>
      <input
        type="hidden"
        name="questionnaireId"
        value={String(questionnaireId)}
      />
      <input type="hidden" name="versionNumber" value={String(versionNumber)} />
      {questions.map((q) => {
        if (q.type === "text") {
          return <TextQuestionInput key={q.qid} question={q} name={q.qid} />;
        }
        if (q.type === "boolean") {
          return <BooleanQuestionInput key={q.qid} question={q} name={q.qid} />;
        }
        return <LikertQuestionInput key={q.qid} question={q} name={q.qid} />;
      })}
      <button type="submit" className={styles.submit}>
        Submit
      </button>
    </form>
  );
}
