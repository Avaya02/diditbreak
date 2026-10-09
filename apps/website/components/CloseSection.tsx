import type { CSSProperties } from "react";

import styles from "./CloseSection.module.css";
import { CopyCommand } from "./CopyCommand";
import { ArrowUpRightIcon, GitHubMark, Mark } from "./icons";

const REPO = "https://github.com/Avaya02/diditbreak";
const NPM = "https://www.npmjs.com/package/diditbreak";

const COMMANDS: Array<[string, string]> = [
  ["init --demo", "Create the ready-made demo repository: free, offline, no API key"],
  ["init", "Set up experiments in your repository: a config and an example task"],
  ["compare [setups..]", "Compare git refs, working (your uncommitted edit) and none"],
  ["ablate [file]", "Remove one CLAUDE.md section, then one skill, at a time"],
  ["report [path]", "Show a past experiment again, without re-running anything"]
];

const CI = [
  "- run: >-",
  "    npx diditbreak compare",
  "    origin/${{ github.base_ref }} HEAD --no-baseline --yes",
  "  env:",
  "    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}"
];

export function CloseSection() {
  return (
    <section id="start" className={`section ${styles.close}`} data-theme="dark">
      <div className="wrap">
        {/* The review's own conclusion: a merge box whose action is the command. */}
        <div className={styles.merge} data-reveal="rise">
          <div className={styles.mergeHead}>
            <span className={styles.mergeIcon} aria-hidden="true">
              <Mark />
            </span>
            <p>
              <strong>Review required</strong>
              <span>This context change hasn’t been tested against your tasks yet.</span>
            </p>
          </div>
          <div className={styles.mergeBody}>
            <h2 className={styles.title}>Test the edit before you trust it.</h2>
            <p className={styles.lead}>
              Start with the demo: a tiny repository with a CLAUDE.md edit to test, and a mock agent that needs no API
              key. Then point it at your own repository.
            </p>
            <div className={styles.actions}>
              <CopyCommand command="npx diditbreak init --demo" size="lg" />
              <a className={styles.link} href={REPO} target="_blank" rel="noreferrer">
                <GitHubMark />
                <span>GitHub</span>
                <ArrowUpRightIcon />
              </a>
              <a className={styles.link} href={NPM} target="_blank" rel="noreferrer">
                <span>npm</span>
                <ArrowUpRightIcon />
              </a>
            </div>
          </div>
        </div>

        <div className={styles.reference}>
          <div className={styles.block}>
            <h3 className={styles.blockTitle}>Commands</h3>
            <dl className={styles.commands} data-reveal-group="">
              {COMMANDS.map(([command, description]) => (
                <div key={command} data-reveal="apply" style={{ "--stagger": "80ms" } as CSSProperties}>
                  <dt>
                    <code>diditbreak {command}</code>
                  </dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}>In CI</h3>
            <pre className={styles.code} data-reveal-group="">
              {CI.map((line) => (
                <code key={line} data-reveal="apply" style={{ "--stagger": "90ms" } as CSSProperties}>
                  {line}
                </code>
              ))}
            </pre>
            <p className={styles.blockNote}>
              Exits 1 and fails the pull request when the change makes the agent clearly worse; exits 2, never 0, when
              most runs could not start.
            </p>
            <p className={styles.blockNote}>
              Needs Node 20+ and git, on macOS or Linux (Windows through WSL). Real runs need Claude Code, logged in or
              with <code>ANTHROPIC_API_KEY</code> set.
            </p>
          </div>
        </div>

        <footer className={styles.footer}>
          <a className={styles.brand} href="#top">
            <Mark />
            <span>diditbreak</span>
          </a>
          <nav className={styles.footerLinks} aria-label="Project">
            <a href={REPO} target="_blank" rel="noreferrer">
              Source
            </a>
            <a href={NPM} target="_blank" rel="noreferrer">
              npm
            </a>
            <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">
              Report an issue
            </a>
          </nav>
          <p className={styles.legal}>
            MIT licensed. Made by{" "}
            <a href="https://github.com/Avaya02" target="_blank" rel="noreferrer">
              Avaya Sharma
            </a>
            .
          </p>
        </footer>
      </div>
    </section>
  );
}
