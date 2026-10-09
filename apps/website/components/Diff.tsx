import type { CSSProperties, ReactNode } from "react";

import styles from "./Diff.module.css";
import { ChevronDownIcon, UnfoldIcon } from "./icons";

/**
 * The page's one component language: a code review diff. A file header with a
 * diffstat, split rows with line numbers and +/− markers, hunk headers, and
 * fold rows. Additions and removals read by inversion, never by colour.
 */

export function DiffFile({
  name,
  stat,
  meta,
  label,
  children,
  className
}: {
  name: ReactNode;
  stat?: { added: number; removed: number };
  meta?: ReactNode;
  /** Describes the file to assistive technology. */
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`${styles.file} ${className ?? ""}`} aria-label={label}>
      <div className={styles.fileHeader}>
        <ChevronDownIcon className={styles.chevron} />
        <code className={styles.fileName}>{name}</code>
        {stat ? <DiffStat added={stat.added} removed={stat.removed} /> : null}
        {meta ? <span className={styles.fileMeta}>{meta}</span> : null}
      </div>
      {children}
    </figure>
  );
}

export function DiffStat({ added, removed }: { added: number; removed: number }) {
  const total = added + removed;
  const solid = total === 0 ? 0 : Math.round((5 * added) / total);
  const outlined = total === 0 ? 0 : 5 - solid;
  return (
    <span className={styles.stat}>
      <span className={styles.statNumbers}>
        <span>+{added}</span>
        <span>−{removed}</span>
      </span>
      <span className={styles.blocks} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} data-kind={i < solid ? "add" : i < solid + outlined ? "del" : "none"} />
        ))}
      </span>
    </span>
  );
}

export interface Side {
  num?: number | string;
  marker?: "+" | "−";
  code?: ReactNode;
  /** Trailing note set flush right, outside the code (a delta, a verdict). */
  aside?: ReactNode;
}

/**
 * One row of a split diff. `context` rows are identical on both sides;
 * `change` rows replace a line; `add` rows exist only on the new side.
 * `apply` animates the row in as the change lands, after `delay`.
 */
export function SplitRow({
  kind,
  old,
  next,
  apply,
  delay,
  reveal
}: {
  kind: "context" | "change" | "add";
  old?: Side;
  next: Side;
  apply?: boolean;
  delay?: number;
  reveal?: boolean;
}) {
  const style = delay !== undefined ? ({ "--d": `${delay}ms` } as CSSProperties) : undefined;
  return (
    <div
      className={styles.row}
      data-kind={kind}
      data-apply={apply ? "" : undefined}
      data-reveal={reveal ? "apply" : undefined}
      style={style}
    >
      <Cell side="old" empty={kind === "add"} {...(old ?? {})} />
      <Cell side="new" {...next} />
    </div>
  );
}

function Cell({ side, empty, num, marker, code, aside }: Side & { side: "old" | "new"; empty?: boolean }) {
  return (
    <div className={styles.side} data-side={side} data-empty={empty ? "" : undefined} aria-hidden={empty ? true : undefined}>
      <span className={styles.num}>{num}</span>
      <span className={styles.marker}>{marker}</span>
      <code className={styles.code}>{code}</code>
      {aside ? <span className={styles.aside}>{aside}</span> : null}
    </div>
  );
}

export function HunkHeader({ children }: { children: ReactNode }) {
  return (
    <div className={styles.hunk}>
      <code>{children}</code>
    </div>
  );
}

export function UnfoldRow({ children }: { children: ReactNode }) {
  return (
    <div className={styles.unfold}>
      <UnfoldIcon />
      <span>{children}</span>
    </div>
  );
}

/** A changed token inside a line: inverted, the way a review tool marks the exact edit. */
export function Token({ children }: { children: ReactNode }) {
  return <mark className={styles.token}>{children}</mark>;
}

/** A unified block (one column): every line its own row, for new files and listings. */
export function UnifiedLines({
  lines,
  start = 1,
  marker = "+",
  reveal = true
}: {
  lines: ReactNode[];
  start?: number;
  marker?: "+" | "−" | null;
  reveal?: boolean;
}) {
  return (
    <div className={styles.unified} data-reveal-group={reveal ? "" : undefined}>
      {lines.map((line, i) => (
        <div
          key={i}
          className={styles.unifiedRow}
          data-kind={marker === "+" ? "add" : marker === "−" ? "del" : "context"}
          data-reveal={reveal ? "apply" : undefined}
          style={{ "--stagger": "45ms" } as CSSProperties}
        >
          <span className={styles.num}>{start + i}</span>
          <span className={styles.marker}>{marker}</span>
          <code className={styles.code}>{line}</code>
        </div>
      ))}
    </div>
  );
}
