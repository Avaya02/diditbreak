# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

The product is a Node CLI published to npm as `diditbreak`. The marketing site is Next.js (the user's choice, 2026-10-09; static HTML on GitHub Pages was offered as the alternative), living in `apps/website` inside the pnpm monorepo and hosted on Vercel.

## Users

Individual developers who use Claude Code daily and maintain their own agent context: `CLAUDE.md`, skills, subagents, MCP config. Their situation: they have just edited that context (often by pasting in more rules) and cannot tell whether the agent got better, worse, or just more expensive. Their job: find out before the change ships, without guessing.

Teams that want a CI check on context changes are a real, supported use, but they are not the website's first audience (user decision, 2026-10-09).

## Product Purpose

diditbreak answers one question: did your `CLAUDE.md` change make your coding agent better or worse? It runs the developer's real tasks with the real agent (Claude Code, headless) in isolated git worktrees, under several context setups (the committed context `HEAD`, uncommitted edits `working`, and no context `none`), several trials each, and measures:

- **success**: the task's own `verify` commands pass;
- **overwhelm**: cost, turns, time, and starting-context tokens;
- **confusion**: forbidden commands run, skills used or missed, actions the agent's permissions refused.

Success means a developer gets a trustworthy verdict on a context change before relying on it.

## Positioning

- It measures the agent's own context, not prompts or models: the same tasks, before and after the same edit, compared per task.
- It refuses to overclaim. "Better" or "worse" is only reported when the difference survives a paired bootstrap; otherwise the verdict is "no clear difference". Cost and turn changes carry 95% intervals.
- It runs the real agent on the developer's own repository, in sandboxes, and never touches their working tree.
- The need is documented: an ETH Zurich study (arXiv 2602.11988, Feb 2026) found LLM-generated `AGENTS.md` files lowered task success by about 3% and raised cost by over 20%; hand-written ones raised cost by up to 19%.
- Neighbours: promptfoo (prompt regression testing, acquired by OpenAI 2026-03-09), Harbor (the Terminal-Bench team's research framework), and Anthropic's own skill tooling (skill-creator, `claude plugin eval`). diditbreak's distinct claim is a git-based before/after comparison of a repository's whole agent setup, as a local command and a CI gate.

## Operating Context

- Used from a terminal inside a git repository: `npx diditbreak <command>`. Node 20+, git, macOS or Linux (Windows via WSL).
- Real runs need Claude Code installed and logged in, or `ANTHROPIC_API_KEY` set.
- Tasks are YAML files in `.diditbreak/tasks/`: a `prompt`, `verify` commands that must exit 0, and behaviour `checks` (`must_change`, `must_not_change`, `forbid_commands`, `expect_skills`, `max_turns`, `max_cost_usd`). Settings live in `diditbreak.config.ts`.
- Commands: `init`, `init --demo`, `compare [setups..]`, `ablate [file]`, `report`. Exit codes: `0` no regression, `1` the last setup is clearly worse, `2` the experiment could not run or answer, `130` interrupted.
- A free, offline mock agent (`--agent mock`) powers the demo and CI; its numbers are simulated and labelled as such.
- In CI (GitHub Actions example in the README), `compare origin/<base> HEAD --no-baseline --yes` fails the job when the pull request's context is clearly worse.

## Capabilities and Constraints

- Context that is swapped per setup: `CLAUDE.md` and `AGENTS.md` in any directory, everything under `.claude/` (skills, subagents, commands, settings), and `.mcp.json`.
- `ablate` removes one `CLAUDE.md` section, then one skill, at a time to find what helps and what hurts.
- Before spending: checks Claude Code is installed and logged in, warns about tasks an agent that does nothing would pass, shows the plan and the worst-case cost, and asks. Every run has a hard budget cap enforced by the agent.
- Runs that could not run (no login, rejected key, failing setup) are left out of the numbers; if most could not run there is no verdict and the exit code is 2.
- Agents: Claude Code is supported. Codex CLI and Gemini CLI are planned, not built, and must not be presented as available.
- No web UI for experiments: the terminal report is the interface. An HTML report is planned, not built.
- Free and open source: MIT license, npm package `diditbreak`, repository github.com/Avaya02/diditbreak.
- The older prompt regression suite and self-hosted API, worker and dashboard exist in the repository but are out of scope for the website (user decision, 2026-10-09).

## Brand Commitments

- Name: `diditbreak`, always lowercase. Plain English, chosen because it states what the tool does.
- Voice: plain, specific, evidence-backed, no hype. Never claims more than the numbers show.
- Binding visual constraint the user set for the website (2026-10-09): monochrome, with a mix of dark and light sections; no gradients; motion that reveals as the visitor scrolls.

## Evidence on Hand

- A real experiment, 2026-10-02: Claude Code (haiku) on the demo repository, 2 tasks × 2 trials × 3 setups = 12 runs in 1m 49s, $0.567 total.
  - `none` 4/4 solved, $0.025 per run, 3.0 turns; `HEAD` 4/4, $0.049, 9.0 turns; `working` 3/4, $0.067, 11.0 turns.
  - `working` vs `HEAD`: −25 pts (95% CI −75 … 0), "no clear difference"; cost +36% (+14% … +60%); turns +22% (+6% … +44%); starting context +450 tokens.
  - The edit pasted 41 lines of generic team-wiki guidelines, including "all tests must use Jest", onto a short, correct `CLAUDE.md`; the agent then ran `npm install --save-dev jest` against the project's no-dependencies rule (1 of 4 runs) and hit 3 blocked actions.
  - Raw results: `.git/diditbreak-backup/realrun/` (local), rendered in `README.md`.
- The study above, verified against its arXiv abstract (2602.11988, fetched 2026-10-09). Verbatim sentences the website quotes: "providing context files does not generally improve task success rates, while increasing inference cost by over 20% on average"; "This observation holds across different LLMs, coding agents, and for both LLM-generated and developer-committed context files"; "any attempts to improve performance should be rigorously evaluated before deployment". The finer figures in the README (about 3% lower success for LLM-generated files, up to 19% higher cost for hand-written ones) come from earlier reading of the paper and are not in the abstract; the website quotes only the abstract.
- The mock demo's output (simulated; must be labelled as simulated wherever shown).
- Absent, and not to be fabricated: users, testimonials, company logos, GitHub stars, download counts, pricing, case studies, benchmarks beyond the run above.

## Product Principles

1. Evidence over assertion: every claim is a measured number with its uncertainty, or it is not made.
2. Never a false pass: a broken setup yields no verdict, never a green check.
3. Spend only with consent: show the worst case first, cap every run.
4. The developer's repository is untouchable: all work happens in disposable sandboxes.
5. The first step is free: the mock demo shows the whole idea without an API key or a cent.
