import type { CSSProperties } from "react";

import { DiffFile, UnifiedLines } from "./Diff";
import styles from "./EvidenceSection.module.css";
import { ArrowUpRightIcon, Mark, PaperIcon } from "./icons";

const PAPER = "https://arxiv.org/abs/2602.11988";

/** Words that rise in sequence; the spaces live between the boxes so none overhangs the edge. */
function Words({ text, start }: { text: string; start: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span key={`${word}-${i}`}>
          <span className={styles.word} data-reveal="rise" style={{ "--i": start + i, "--stagger": "28ms" } as CSSProperties}>
            {word}
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

/** Verbatim from the abstract of arXiv 2602.11988. */
const FINDING = "providing context files does not generally improve task success rates, while increasing inference cost by";

export function EvidenceSection() {
  const count = FINDING.split(" ").length;
  return (
    <section id="evidence" className="section" data-theme="dark">
      <div className="wrap">
        <h2 className="visually-hidden">What the research says about context files</h2>

        <DiffFile
          name="CLAUDE.md"
          stat={{ added: 41, removed: 0 }}
          meta="or AGENTS.md, or any context file"
          label="A research paper's finding, cited as a review comment on a line added to CLAUDE.md"
          className={styles.file}
        >
          <UnifiedLines lines={["## Engineering standards (pasted from the team wiki)"]} start={10} reveal={false} />

          <div className={styles.thread}>
            <div className={styles.comment}>
              <p className={styles.author}>
                <span className={styles.avatar} aria-hidden="true">
                  <PaperIcon />
                </span>
                <a href={PAPER} target="_blank" rel="noreferrer">
                  <cite>Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?</cite>
                  <ArrowUpRightIcon className={styles.out} />
                </a>
                <span className={styles.meta}>arXiv 2602.11988 · February 2026</span>
              </p>

              <blockquote className={styles.quote} cite={PAPER} data-reveal-group="">
                <p>
                  <span className={styles.open} aria-hidden="true">
                    “
                  </span>
                  <Words text={FINDING} start={0} />{" "}
                  <mark className={styles.mark}>
                    <Words text="over 20%" start={count} />
                  </mark>{" "}
                  <Words text="on average.”" start={count + 2} />
                </p>
              </blockquote>

              <p className={styles.more} data-reveal="rise" style={{ "--delay": "500ms" } as CSSProperties}>
                The paper adds that this “holds across different LLMs, coding agents, and for both LLM-generated and
                developer-committed context files,” and concludes that “any attempts to improve performance should be
                rigorously evaluated before deployment.”
              </p>
            </div>

            <div className={styles.reply} data-reveal="rise" style={{ "--delay": "700ms" } as CSSProperties}>
              <p className={styles.author}>
                <Mark className={styles.replyMark} />
                <strong>diditbreak</strong>
                <span className={styles.meta}>replied</span>
              </p>
              <p className={styles.replyBody}>
                That evaluation, for your repository: <code>npx diditbreak compare</code>
              </p>
            </div>
          </div>
        </DiffFile>
      </div>
    </section>
  );
}
