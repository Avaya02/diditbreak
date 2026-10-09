"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./CopyCommand.module.css";
import { CheckIcon, CopyIcon } from "./icons";

type State = "idle" | "copied" | "selected";

/** The page's primary action: the command itself, copied in one click. */
export function CopyCommand({ command, size = "md" }: { command: string; size?: "md" | "lg" }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<number | undefined>(undefined);
  const text = useRef<HTMLElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const settle = (next: State) => {
    setState(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2200);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      settle("copied");
    } catch {
      // No clipboard permission: select the text so ⌘C / Ctrl+C still works.
      if (text.current) {
        const range = document.createRange();
        range.selectNodeContents(text.current);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
      settle("selected");
    }
  };

  return (
    <button type="button" className={styles.chip} data-size={size} data-state={state} onClick={copy}>
      <span className={styles.prompt} aria-hidden="true">
        $
      </span>
      <code ref={text} className={styles.command}>
        {command}
      </code>
      <span className={styles.action}>
        <span className={styles.icon} aria-hidden="true">
          {state === "copied" ? <CheckIcon /> : <CopyIcon />}
        </span>
        <span className={styles.label}>{state === "copied" ? "Copied" : state === "selected" ? "Press ⌘C" : "Copy"}</span>
      </span>
      <span className="visually-hidden" aria-live="polite">
        {state === "copied" ? "Command copied to the clipboard" : state === "selected" ? "Command selected; press Command C to copy" : ""}
      </span>
    </button>
  );
}
