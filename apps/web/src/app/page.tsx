import { faThumbsUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { math } from "@questionnaires/lib";

import styles from "./page.module.css";

const result = math.add(1, 2);

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Next.js 16 workspace</p>
        <h1 className={styles.title}>Hello World</h1>
        <p className={styles.copy}>Shared library result: 1 + 2 = {result}</p>
        <div className={styles.iconRow}>
          <FontAwesomeIcon icon={faThumbsUp} className={styles.icon} />
          <span>Font Awesome is ready.</span>
        </div>
      </section>
    </main>
  );
}
