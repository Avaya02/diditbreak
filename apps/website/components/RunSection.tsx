import type { CSSProperties, ReactNode } from "react";

import { REPORT_LINES, REPORT_LINES_NARROW } from "@/lib/run";

import { Mark } from "./icons";
import styles from "./RunSection.module.css";

type Note = "verdict" | "cost" | "rule";

/** Review comments, attached after the report line they explain. */
const NOTES: Record<Note, ReactNode> = {
  verdict: (
    <>One failure in four runs is not proof the edit made the agent less reliable, so the verdict is “no clear difference”, not “worse”.</>
  ),
  cost: <>This part is real: the whole interval sits above zero. The edit made the work 36% more expensive.</>,
  rule: <>Following the pasted wiki, the agent installed Jest and broke the project’s “no dependencies” rule.</>
};

/** Lines the CLI prints before the report, for this demo's settings. */
const PREAMBLE = [
  " 3 setups × 2 tasks × 2 trials = 12 agent runs",
  " Spend is capped at $0.5 per run: at most $6.00 in total.",
  " Continue? [y/N] y",
  ""
];

const PREAMBLE_NARROW = [
  " 3 setups × 2 tasks × 2 trials",
  " = 12 agent runs",
  " Spend is capped at $0.5 per run:",
  " at most $6.00 in total.",
  " Continue? [y/N] y",
  ""
];

/** Which report line each note follows, by index into that report. */
const WIDE_NOTES: Record<number, Note> = {
  [REPORT_LINES.indexOf("   working  −25 pts   (−75 … ±0)     no clear difference")]: "verdict",
  [REPORT_LINES.indexOf("            cost +36% (+14% … +60%) · turns +22% (+6% … +44%)")]: "cost",
  [REPORT_LINES.indexOf("                               e.g. ran: npm install --save-dev jest")]: "rule"
};

const NARROW_NOTES: Record<number, Note> = {
  12: "verdict",
  14: "cost",
  [REPORT_LINES_NARROW.indexOf("   e.g. ran: npm install --save-dev jest")]: "rule"
};

function Screen({
  preamble,
  report,
  notes,
  className
}: {
  preamble: readonly string[];
  report: readonly string[];
  notes: Record<number, Note>;
  className: string | undefined;
}) {
  let index = 0;
  const line = (text: string, key: string, extra?: string) => (
    <div key={key} className={`${styles.line} ${extra ?? ""}`} data-reveal="print" style={{ "--i": index++ } as CSSProperties}>
      {text === "" ? " " : text}
    </div>
  );

  return (
    <div className={`${styles.screen} ${className ?? ""}`} data-reveal-group="">
      <div className={`${styles.line} ${styles.prompt}`} data-reveal="print" style={{ "--i": index++ } as CSSProperties}>
        <span className={styles.dollar}>$</span> npx diditbreak compare
      </div>
      {preamble.map((text, i) => line(text, `pre-${i}`))}
      {report.map((text, i) => {
        const printed = line(text, `report-${i}`, text.startsWith(" setup") || text.startsWith(" vs ") ? styles.head : undefined);
        const note = notes[i];
        if (!note) {
          return printed;
        }
        return [
          printed,
          <div
            key={`note-${i}`}
            className={styles.comment}
            data-reveal="rise"
            style={{ "--i": index++, "--stagger": "34ms", "--delay": "260ms" } as CSSProperties}
          >
            <Mark className={styles.commentMark} />
            <p>{NOTES[note]}</p>
          </div>
        ];
      })}
    </div>
  );
}

export function RunSection() {
  return (
    <section id="run" className="section" data-theme="dark">
      <div className={`wrap ${styles.layout}`}>
        <div className={styles.copy}>
          <h2 className={styles.title} data-reveal="rise">
            One command runs the whole experiment.
          </h2>
          <p className={styles.lead} data-reveal="rise" style={{ "--delay": "120ms" } as CSSProperties}>
            It checks Claude Code is installed and logged in, shows the plan and the most it could cost, and asks. Then
            it runs every task under each setup, several times, each in a fresh git worktree, and prints the comparison.
          </p>
          <dl className={styles.facts} data-reveal-group="">
            <div data-reveal="rise">
              <dt>setups</dt>
              <dd>
                <code>HEAD</code> your committed context, <code>working</code> your edit, <code>none</code> no context
                at all
              </dd>
            </div>
            <div data-reveal="rise">
              <dt>verdict</dt>
              <dd>better, worse, or no clear difference, for the last setup against the reference</dd>
            </div>
            <div data-reveal="rise">
              <dt>exit code</dt>
              <dd>
                <code>1</code> when the edit is clearly worse, so it can fail a pull request
              </dd>
            </div>
          </dl>
        </div>

        <figure className={styles.terminal} aria-label="The real output of diditbreak compare on the demo project">
          <div className={styles.bar}>
            <code>~/context-demo</code>
            <span className={styles.wideOnly}>zsh</span>
            <span className={styles.narrowOnly}>zsh · narrowed to fit</span>
          </div>
          <Screen preamble={PREAMBLE} report={REPORT_LINES} notes={WIDE_NOTES} className={styles.wideOnly} />
          <Screen preamble={PREAMBLE_NARROW} report={REPORT_LINES_NARROW} notes={NARROW_NOTES} className={styles.narrowOnly} />
        </figure>
      </div>
    </section>
  );
}
