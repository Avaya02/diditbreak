import type { CSSProperties } from "react";

import { CopyCommand } from "./CopyCommand";
import { DiffFile, HunkHeader, SplitRow, Token, UnfoldRow } from "./Diff";
import styles from "./Hero.module.css";
import { ArrowRightIcon, ArrowUpRightIcon, GitHubMark, Mark } from "./icons";

const REPO = "https://github.com/Avaya02/diditbreak";

/** Milliseconds after the review comes into view at which each part of the change lands. */
const T = { edit: 380, behaviour: 1250, verdict: 2250 };

/**
 * Starts the change landing once the review is on screen. Inline, so it runs
 * during parsing and never waits for hydration; without it (or with reduced
 * motion) the review simply renders in its final state.
 */
const PLAY_ON_VIEW = `(function(){var el=document.getElementById("hero-review");if(!el)return;var play=function(){el.setAttribute("data-play","")};if(!("IntersectionObserver" in window)){play();return}var io=new IntersectionObserver(function(entries){if(entries[0]&&entries[0].isIntersecting){play();io.disconnect()}},{threshold:0.3});io.observe(el)})();`;

const RULE = (
  <>
    - Run tests with `node --test`. There is no build step and <u className={styles.rule}>no dependencies; do not add any.</u>
  </>
);

export function Hero() {
  return (
    <section id="top" className={`section ${styles.hero}`} data-theme="light">
      <div className="wrap">
        <h1 className={styles.title}>
          Did your <span className={styles.keep}>CLAUDE.md edit</span> <span className={styles.keep}>break your agent?</span>
        </h1>

        <div className={styles.intro}>
          <p className={styles.lead}>Run your real tasks with Claude Code before and after the edit.</p>
          <div id="hero-cta" className={styles.actions}>
            <CopyCommand command="npx diditbreak init --demo" />
            <a className={styles.secondary} href={REPO} target="_blank" rel="noreferrer">
              <GitHubMark />
              <span>GitHub</span>
              <ArrowUpRightIcon className={styles.arrow} />
            </a>
          </div>
        </div>

        <div id="hero-review" className={styles.review} data-apply-scope="" suppressHydrationWarning>
          <DiffFile
            name="CLAUDE.md"
            stat={{ added: 41, removed: 0 }}
            meta="HEAD vs working"
            label="A diff of CLAUDE.md that adds 41 lines of team-wiki guidelines, followed by how the agent's behaviour changed in 12 real runs"
          >
            <SplitRow kind="context" old={{ num: 4, code: RULE }} next={{ num: 4, code: RULE }} />
            <UnfoldRow>Lines 5–8 unchanged</UnfoldRow>
            <SplitRow kind="add" apply delay={T.edit} next={{ num: 9, marker: "+", code: " " }} />
            <SplitRow kind="add" apply delay={T.edit + 100} next={{ num: 10, marker: "+", code: "## Engineering standards (pasted from the team wiki)" }} />
            <SplitRow kind="add" apply delay={T.edit + 200} next={{ num: 11, marker: "+", code: " " }} />
            <SplitRow kind="add" apply delay={T.edit + 300} next={{ num: 12, marker: "+", code: "### Testing" }} />
            <SplitRow
              kind="add"
              apply
              delay={T.edit + 400}
              next={{
                num: 13,
                marker: "+",
                code: (
                  <>
                    - All tests must use <Token>Jest</Token>. Install it with `<Token>npm install --save-dev jest</Token>` before writing any test.
                  </>
                )
              }}
            />
            <UnfoldRow>36 more added lines from the team wiki</UnfoldRow>

            <HunkHeader>@@ agent behaviour · 12 real runs · claude-code (haiku) @@</HunkHeader>
            <SplitRow
              kind="change"
              apply
              delay={T.behaviour}
              old={{ marker: "−", code: "solved      4/4   100%" }}
              next={{ marker: "+", code: "solved      3/4    75%" }}
            />
            <SplitRow
              kind="change"
              apply
              delay={T.behaviour + 140}
              old={{ marker: "−", code: "cost/run    $0.049" }}
              next={{ marker: "+", code: "cost/run    $0.067", aside: "+36%" }}
            />
            <SplitRow
              kind="add"
              apply
              delay={T.behaviour + 280}
              next={{
                marker: "+",
                code: (
                  <>
                    ran         <Token>npm install --save-dev jest</Token>
                  </>
                ),
                aside: "broke a rule"
              }}
            />

            <div className={styles.status} style={{ "--verdict": `${T.verdict}ms` } as CSSProperties}>
              <span className={styles.statusIcon} aria-hidden="true">
                <span className={styles.spinner} />
                <Mark className={styles.done} />
              </span>
              <div className={styles.statusBody}>
                <p className={styles.statusRunning} aria-hidden="true">
                  diditbreak compare · resampling 2,000 times…
                </p>
                <p className={styles.statusResult}>
                  <strong>diditbreak compare</strong>
                  <span>Success: no clear difference (−25 pts, 95% CI −75 … 0)</span>
                  <span>Cost: +36% (95% CI +14 … +60%)</span>
                  <span>1 rule broken</span>
                </p>
              </div>
              <a className={styles.details} href="#run">
                See the run <ArrowRightIcon />
              </a>
            </div>
          </DiffFile>

          <p className={styles.provenance}>
            Real output from the demo project: Claude Code (haiku), 2 tasks × 2 runs per setup, 12 runs in 1m 49s for
            $0.57, on 2026-10-02. The edit pasted 41 lines of team-wiki guidelines onto a short, correct CLAUDE.md. The
            demo itself is free and offline; Node 20+, macOS or Linux.
          </p>
        </div>
        <script dangerouslySetInnerHTML={{ __html: PLAY_ON_VIEW }} />
      </div>
    </section>
  );
}
