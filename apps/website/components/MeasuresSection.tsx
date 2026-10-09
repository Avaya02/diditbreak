import type { CSSProperties, ReactNode } from "react";

import styles from "./MeasuresSection.module.css";

interface Measure {
  name: string;
  meaning: string;
  head: string;
  working: string;
  change: ReactNode;
  changed: boolean;
}

/** Every value is from the real run in the hero; nothing is illustrative. */
const GROUPS: Array<{ question: string; hunk: string; rows: Measure[] }> = [
  {
    question: "Does it finish the job?",
    hunk: "@@ success @@",
    rows: [
      {
        name: "Solved",
        meaning: "your verify commands and rules pass",
        head: "4/4",
        working: "3/4",
        change: "−25 pts, no clear difference",
        changed: true
      }
    ]
  },
  {
    question: "Is the context weighing it down?",
    hunk: "@@ overwhelm @@",
    rows: [
      { name: "Cost per run", meaning: "from the agent’s own report", head: "$0.049", working: "$0.067", change: "+36%", changed: true },
      { name: "Turns", meaning: "model round trips per run", head: "9.0", working: "11.0", change: "+22%", changed: true },
      {
        name: "Starting context",
        meaning: "tokens carried into the first model call, before any work",
        head: "18.5k",
        working: "18.9k",
        change: "+450 tokens",
        changed: true
      }
    ]
  },
  {
    question: "Is it following the rules?",
    hunk: "@@ confusion @@",
    rows: [
      {
        name: "Rules broken",
        meaning: "forbidden commands the agent ran",
        head: "0/4",
        working: "1/4",
        change: <code>npm install --save-dev jest</code>,
        changed: true
      },
      { name: "Blocked actions", meaning: "attempts its permissions refused", head: "0", working: "3", change: "+3", changed: true },
      {
        name: "Skills",
        meaning: "used, loaded but ignored, or missing, when a task expects one",
        head: "–",
        working: "–",
        change: "no skills in this demo",
        changed: false
      }
    ]
  }
];

export function MeasuresSection() {
  let index = 0;
  return (
    <section id="measures" className="section" data-theme="light">
      <div className="wrap">
        <div className={styles.head}>
          <h2 className={styles.title} data-reveal="rise">
            Three questions about every run.
          </h2>
          <p className={styles.lead} data-reveal="rise" style={{ "--delay": "120ms" } as CSSProperties}>
            Each answer comes from your own checks and the agent’s own transcript. No model grades its own work.
          </p>
        </div>

        <div className={styles.table} role="table" aria-label="What diditbreak measures, with the values from the real run">
          <div className={styles.columns} role="row">
            <span role="columnheader">measure</span>
            <span role="columnheader">HEAD</span>
            <span role="columnheader">working</span>
            <span role="columnheader">change</span>
          </div>
          {GROUPS.map((group) => (
            <div key={group.hunk} role="rowgroup" data-reveal-group="">
              <div className={styles.hunk} role="row" data-reveal="apply">
                <code role="cell">{group.hunk}</code>
                <span role="cell">{group.question}</span>
              </div>
              {group.rows.map((row) => {
                const i = index++;
                return (
                  <div
                    key={row.name}
                    className={styles.row}
                    role="row"
                    data-changed={row.changed}
                    data-reveal="apply"
                    style={{ "--i": i % 4, "--stagger": "90ms" } as CSSProperties}
                  >
                    <div role="cell" className={styles.measure}>
                      <p className={styles.name}>{row.name}</p>
                      <p className={styles.meaning}>{row.meaning}</p>
                    </div>
                    <code role="cell" className={styles.old}>
                      <span className={styles.marker} aria-hidden="true">
                        {row.changed ? "−" : ""}
                      </span>
                      {row.head}
                    </code>
                    <code role="cell" className={styles.new}>
                      <span className={styles.marker} aria-hidden="true">
                        {row.changed ? "+" : ""}
                      </span>
                      {row.working}
                    </code>
                    <span role="cell" className={styles.change}>
                      {row.change}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
