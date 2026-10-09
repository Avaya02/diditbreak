import type { CSSProperties, ReactNode } from "react";

import { TRIALS, type Setup } from "@/lib/run";

import { DiffFile, UnifiedLines } from "./Diff";
import styles from "./HowSection.module.css";
import { CheckIcon, CrossIcon, Mark } from "./icons";

/** The demo's real task file, without the mock agent's script. */
const TASK_YAML = [
  "prompt: |",
  "  Add a `slugify(text)` function to src/strings.js. It lowercases the text,",
  "  trims it, replaces every run of non-alphanumeric characters with a single",
  "  hyphen, and strips leading and trailing hyphens. Export it.",
  "",
  "# A hidden check the agent never sees, so it cannot write tests that game it.",
  "verify: >-",
  "  node -e \"import('./src/strings.js').then(({ slugify: s }) => process.exit(",
  "  s('  Hello, World!  ') === 'hello-world' && s('Rock & Roll') === 'rock-roll' && s('--x--') === 'x' ? 0 : 1))\"",
  "",
  "checks:",
  "  must_change: src/strings.js",
  "  must_not_change: package.json",
  "  forbid_commands: npm install"
];

const SANDBOX_ROOT = "/tmp/diditbreak/2026-10-02T08-05-12-855/";

const SANDBOXES: Array<[string, string]> = [
  ["none--slugify--1/", "no CLAUDE.md at all"],
  ["HEAD--slugify--1/", "CLAUDE.md as committed"],
  ["working--slugify--1/", "CLAUDE.md with your edit"],
  ["none--truncate--1/", ""],
  ["…", "one per setup × task × run, removed afterwards"]
];

const SETUPS: Array<{ setup: Setup; label: string }> = [
  { setup: "none", label: "none" },
  { setup: "HEAD", label: "HEAD" },
  { setup: "working", label: "working" }
];

/** One step: a review comment pinned to the file it explains. */
function Step({ title, body, children }: { title: string; body: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.step} data-reveal-group="">
      <div className={styles.comment} data-reveal="rise">
        <p className={styles.author}>
          <Mark className={styles.avatar} />
          <strong>diditbreak</strong>
          <span>commented</span>
        </p>
        <h3 className={styles.stepTitle}>{title}</h3>
        <p className={styles.stepBody}>{body}</p>
      </div>
      <div className={styles.stepFile} data-reveal="rise">
        {children}
      </div>
    </div>
  );
}

export function HowSection() {
  return (
    <section id="how" className="section" data-theme="light">
      <div className="wrap">
        <div className={styles.head}>
          <h2 className={styles.title} data-reveal="rise">
            Same tasks. Different context. Several runs.
          </h2>
          <p className={styles.lead} data-reveal="rise" style={{ "--delay": "120ms" } as CSSProperties}>
            No synthetic benchmark and no model grading itself: your repository, your tasks, the real agent. The only
            thing that changes between setups is the context.
          </p>
        </div>

        <div className={styles.files}>
          <Step
            title="Write a task"
            body={
              <>
                A small, real change from your backlog, plus a command that proves it worked. The agent never sees the
                check, so it can’t write code aimed at it. Rules like <code>forbid_commands</code> catch what tests can’t.
              </>
            }
          >
            <DiffFile name=".diditbreak/tasks/slugify.yaml" stat={{ added: 14, removed: 0 }} label="An example task file">
              <UnifiedLines lines={TASK_YAML} />
            </DiffFile>
          </Step>

          <Step
            title="Every run gets a sandbox"
            body={
              <>
                Each run starts from a fresh git worktree of the same commit, so the code is identical and only the
                context differs. Your working tree is never touched.
              </>
            }
          >
            <DiffFile name="/tmp/diditbreak/" meta="git worktree" label="The sandboxes created for one experiment">
              <div className={styles.tree}>
                <code className={styles.treeRoot}>{SANDBOX_ROOT}</code>
                <ul className={styles.treeList} data-reveal-group="">
                  {SANDBOXES.map(([path, note], i) => (
                    <li key={path} className={styles.treeRow} data-reveal="apply" style={{ "--i": i, "--stagger": "70ms" } as CSSProperties}>
                      <code>{path}</code>
                      {note ? <span>{note}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </DiffFile>
          </Step>

          <Step
            title="Run it more than once"
            body={
              <>
                Agents are random: the same task can pass on one run and fail on the next. So every task runs several
                times per setup, and every run is saved for you to re-read.
              </>
            }
          >
            <DiffFile name=".diditbreak/runs/2026-10-02T08-05-12-855/" meta="12 runs · real" label="Pass or fail for each of the 12 real runs">
              <div className={styles.grid} role="table" aria-label="Runs per setup">
                <div className={styles.gridHead} role="row">
                  <span role="columnheader">setup</span>
                  <span role="columnheader">slugify #1</span>
                  <span role="columnheader">slugify #2</span>
                  <span role="columnheader">truncate #1</span>
                  <span role="columnheader">truncate #2</span>
                  <span role="columnheader">cost/run</span>
                </div>
                {SETUPS.map(({ setup, label }, row) => {
                  const runs = (["slugify", "truncate"] as const).flatMap((task) =>
                    ([1, 2] as const).map((trial) => TRIALS.find((t) => t.setup === setup && t.task === task && t.trial === trial)!)
                  );
                  const cost = runs.reduce((total, run) => total + run.costUsd, 0) / runs.length;
                  return (
                    <div key={setup} className={styles.gridRow} role="row" data-reveal-group="">
                      <code role="rowheader">{label}</code>
                      {runs.map((run, i) => (
                        <span
                          key={`${run.task}-${run.trial}`}
                          role="cell"
                          className={styles.cell}
                          data-passed={run.passed}
                          data-reveal="rise"
                          style={{ "--i": row * 4 + i, "--stagger": "55ms" } as CSSProperties}
                          aria-label={run.passed ? "passed" : `failed: ran ${run.brokeRule}`}
                        >
                          {run.passed ? <CheckIcon /> : <CrossIcon />}
                        </span>
                      ))}
                      <code role="cell" className={styles.cost}>
                        ${cost.toFixed(3)}
                      </code>
                    </div>
                  );
                })}
                <p className={styles.gridNote}>
                  The one failure: <code>working</code> × truncate #1 ran <code>npm install --save-dev jest</code>.
                </p>
              </div>
            </DiffFile>
          </Step>
        </div>
      </div>
    </section>
  );
}
