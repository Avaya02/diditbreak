/**
 * The real experiment shown on the page: 12 Claude Code runs on the demo
 * repository, 2026-10-02. Values are copied verbatim from that run's
 * results.json; nothing here is simulated or rounded for effect.
 */

export type Setup = "none" | "HEAD" | "working";
export type Task = "slugify" | "truncate";

export interface Trial {
  setup: Setup;
  task: Task;
  trial: 1 | 2;
  passed: boolean;
  costUsd: number;
  turns: number;
  contextTokens: number;
  seconds: number;
  /** Actions the agent's permissions refused. */
  blocked: number;
  /** The forbidden command the agent ran, when it broke the rule. */
  brokeRule?: string;
}

export const RUN = {
  date: "2026-10-02",
  agent: "Claude Code",
  model: "haiku",
  tasks: 2,
  trialsPerTask: 2,
  runs: 12,
  duration: "1m 49s",
  totalCost: "$0.567"
} as const;

export const TRIALS: Trial[] = [
  { setup: "none", task: "slugify", trial: 1, passed: true, costUsd: 0.026211299999999996, turns: 3, contextTokens: 18267, seconds: 10.1, blocked: 0 },
  { setup: "HEAD", task: "slugify", trial: 1, passed: true, costUsd: 0.04953880000000001, turns: 9, contextTokens: 18461, seconds: 19.7, blocked: 0 },
  { setup: "working", task: "slugify", trial: 1, passed: true, costUsd: 0.0847411, turns: 14, contextTokens: 18912, seconds: 49.2, blocked: 1 },
  { setup: "none", task: "truncate", trial: 1, passed: true, costUsd: 0.024634500000000004, turns: 3, contextTokens: 18262, seconds: 8.5, blocked: 0 },
  { setup: "HEAD", task: "truncate", trial: 1, passed: true, costUsd: 0.0481204, turns: 9, contextTokens: 18455, seconds: 21.4, blocked: 0 },
  { setup: "working", task: "truncate", trial: 1, passed: false, costUsd: 0.0714182, turns: 11, contextTokens: 18902, seconds: 44.3, blocked: 2, brokeRule: "npm install --save-dev jest" },
  { setup: "none", task: "slugify", trial: 2, passed: true, costUsd: 0.0256186, turns: 3, contextTokens: 18268, seconds: 8.9, blocked: 0 },
  { setup: "HEAD", task: "slugify", trial: 2, passed: true, costUsd: 0.05104179999999999, turns: 9, contextTokens: 18460, seconds: 24.6, blocked: 0 },
  { setup: "working", task: "slugify", trial: 2, passed: true, costUsd: 0.0576187, turns: 10, contextTokens: 18910, seconds: 28.5, blocked: 0 },
  { setup: "none", task: "truncate", trial: 2, passed: true, costUsd: 0.0248505, turns: 3, contextTokens: 18263, seconds: 9.2, blocked: 0 },
  { setup: "HEAD", task: "truncate", trial: 2, passed: true, costUsd: 0.04812929999999999, turns: 9, contextTokens: 18456, seconds: 21.6, blocked: 0 },
  { setup: "working", task: "truncate", trial: 2, passed: true, costUsd: 0.054834, turns: 9, contextTokens: 18906, seconds: 29.3, blocked: 0 }
];

const TASKS: Task[] = ["slugify", "truncate"];

/** Values for one setup, grouped by task, in task order: the shape the bootstrap pairs on. */
export function byTask<T>(setup: Setup, pick: (trial: Trial) => T): T[][] {
  return TASKS.map((task) => TRIALS.filter((t) => t.setup === setup && t.task === task).map(pick));
}

/**
 * The same report narrowed for phone screens: identical values, with the
 * table's context and time columns dropped and long lines broken in two.
 * The terminal labels it as narrowed wherever it is shown.
 */
export const REPORT_LINES_NARROW = [
  " diditbreak · claude-code (haiku)",
  " 2 tasks × 2 trials · 12 runs · 1m 49s",
  "",
  " setup    solved       cost/run  turns",
  " none       4/4  100%  $0.025    3.0",
  " HEAD       4/4  100%  $0.049    9.0",
  " working    3/4   75%  $0.067    11.0",
  "",
  " vs HEAD  (95% intervals)",
  "   none     ±0 pts   (±0 … ±0)",
  "            no clear difference",
  "   working  −25 pts  (−75 … ±0)",
  "            no clear difference",
  "            cost  +36%  (+14% … +60%)",
  "            turns +22%  (+6% … +44%)",
  "",
  " Rules broken",
  "   forbid_command npm install",
  "   none 0/4   HEAD 0/4   working 1/4",
  "   e.g. ran: npm install --save-dev jest",
  "",
  " Blocked actions",
  "   working  3",
  "",
  " Total cost $0.567"
] as const;

/** The CLI's own report for this run, line for line. */
export const REPORT_LINES = [
  " diditbreak · claude-code (haiku) · 2 tasks × 2 trials · 12 runs · 1m 49s",
  "",
  " setup    solved         cost/run  turns  context  time/run",
  " none       4/4  100%    $0.025    3.0    18.3k    9s",
  " HEAD       4/4  100%    $0.049    9.0    18.5k    22s",
  " working    3/4   75%    $0.067    11.0   18.9k    38s",
  "",
  " vs HEAD  (95% intervals: one that spans zero could be noise)",
  "   none     ±0 pts    (±0 … ±0)      no clear difference",
  "            cost −49% (−49% … −48%) · turns −67% (−67% … −67%)",
  "   working  −25 pts   (−75 … ±0)     no clear difference",
  "            cost +36% (+14% … +60%) · turns +22% (+6% … +44%)",
  "",
  " Rules broken  (runs that broke the rule / runs)",
  "   forbid_command npm install  none 0/4   HEAD 0/4   working 1/4",
  "                               e.g. ran: npm install --save-dev jest",
  "",
  " Blocked actions  (attempts the agent's permissions refused)",
  "   working  3",
  "",
  " Total cost $0.567"
] as const;
