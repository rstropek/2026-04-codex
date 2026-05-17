import styles from "../page.module.css";

export default function AboutPage() {
  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Section</p>
      <h1 className={styles.title}>About</h1>
      <p className={styles.lede}>
        A learning workspace for building questionnaire tooling with Next.js.
      </p>
    </section>
  );
}
