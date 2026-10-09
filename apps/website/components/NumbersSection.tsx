import type { CSSProperties } from "react";

import { BootstrapFigure } from "./BootstrapFigure";
import styles from "./NumbersSection.module.css";

export function NumbersSection() {
  return (
    <section id="numbers" className="section" data-theme="dark">
      <div className="wrap">
        <div className={styles.head}>
          <h2 className={styles.title} data-reveal="rise">
            It says “worse” only when the numbers prove it.
          </h2>
          <p className={styles.lead} data-reveal="rise" style={{ "--delay": "120ms" } as CSSProperties}>
            Agents are random, so one comparison proves little. diditbreak resamples the tasks, then the runs within
            each task, 2,000 times, and reports a 95% interval. An interval that reaches zero means no clear difference.
          </p>
        </div>

        <figure className={styles.figure}>
          <BootstrapFigure />
          <figcaption className="visually-hidden">
            Tasks solved, working against HEAD: −25 points, 95% interval −75 to 0, no clear difference. Cost per run:
            +36%, interval +14% to +60%. Turns per run: +22%, interval +6% to +44%.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
