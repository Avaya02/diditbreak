import type { CSSProperties } from "react";

import { CheckIcon } from "./icons";
import styles from "./SafetySection.module.css";

const CHECKS: Array<{ title: string; body: string }> = [
  {
    title: "Your working tree is never touched",
    body: "Every run happens in a disposable git worktree that is removed when it finishes."
  },
  {
    title: "It asks before spending",
    body: "You see the plan and the most it could cost first, and every run has a hard budget cap enforced by the agent."
  },
  {
    title: "A broken setup is never a pass",
    body: "If runs can’t start (not logged in, a rejected key, a failing setup command), there is no verdict and the exit code is 2."
  },
  {
    title: "Ctrl-C is safe",
    body: "It stops every agent and anything they started, removes the sandboxes, and keeps the runs that finished."
  },
  {
    title: "Your machine stays out of the result",
    body: "Personal settings and MCP servers are shut out of every run, so the numbers describe the repository, not your laptop."
  }
];

export function SafetySection() {
  return (
    <section id="safety" className="section" data-theme="light">
      <div className={`wrap ${styles.layout}`}>
        <div className={styles.copy}>
          <h2 className={styles.title} data-reveal="rise">
            Safe to run on your real repository.
          </h2>
          <p className={styles.lead} data-reveal="rise" style={{ "--delay": "120ms" } as CSSProperties}>
            It is built for the repository you actually work in, so it treats that repository, and your money, with
            care.
          </p>
        </div>

        <div className={styles.panel} data-reveal-group="">
          <div className={styles.summary} data-reveal="check" style={{ "--i": CHECKS.length } as CSSProperties}>
            <span className={styles.badge} aria-hidden="true">
              <span className={styles.spin} />
              <CheckIcon className={styles.tick} />
            </span>
            {/* Says "running" until the last check resolves: never a pass shown early. */}
            <p className={styles.summaryText}>
              <span className={styles.running} aria-hidden="true">
                <strong>Running {CHECKS.length} checks…</strong>
                <span className={styles.summaryNote}>diditbreak compare</span>
              </span>
              <span className={styles.passed}>
                <strong>All checks have passed</strong>
                <span className={styles.summaryNote}>{CHECKS.length} successful checks</span>
              </span>
            </p>
          </div>
          <ul className={styles.list}>
            {CHECKS.map((check, i) => (
              <li key={check.title} className={styles.item} data-reveal="check" style={{ "--i": i } as CSSProperties}>
                <span className={styles.icon} aria-hidden="true">
                  <span className={styles.spin} />
                  <CheckIcon className={styles.tick} />
                </span>
                <div>
                  <p className={styles.itemTitle}>{check.title}</p>
                  <p className={styles.itemBody}>{check.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
