import Link from "next/link";
import pageStyles from "../../../../page.module.css";

export default function ThanksPage() {
  return (
    <section className={pageStyles.page}>
      <p className={pageStyles.eyebrow}>Submitted</p>
      <h1 className={pageStyles.title}>Thanks for your answers</h1>
      <p className={pageStyles.lede}>
        Your responses have been recorded.{" "}
        <Link href="/questionnaires">Back to all questionnaires</Link>.
      </p>
    </section>
  );
}
