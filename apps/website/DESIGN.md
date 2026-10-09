---
name: diditbreak website
description: Did your CLAUDE.md edit break your agent? A marketing page built as one monochrome code review.
colors:
  paper: "#f5f5f5"
  ink: "#0a0a0a"
  review-fg-2: "#474747"
  review-fg-3: "#6e6e6e"
  review-line: "#e1e1e1"
  review-line-2: "#cbcbcb"
  review-surface: "#ffffff"
  review-bar: "#f0f0f0"
  review-bar-strong: "#e4e4e4"
  terminal-fg: "#ededed"
  terminal-fg-2: "#ababab"
  terminal-fg-3: "#858585"
  terminal-line: "#222222"
  terminal-line-2: "#333333"
  terminal-surface: "#111111"
  terminal-bar: "#181818"
  terminal-bar-strong: "#232323"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.15rem, 1rem + 4.9vw, 5.75rem)"
    fontWeight: 760
    lineHeight: 0.96
    letterSpacing: "-0.038em"
    fontVariation: "'wdth' 112"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.05rem, 1.3rem + 2.6vw, 3.6rem)"
    fontWeight: 720
    lineHeight: 1.02
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 112"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.2rem, 1.08rem + 0.4vw, 1.4rem)"
    fontWeight: 720
    lineHeight: 1.2
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 112"
  lead:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.1rem, 1.02rem + 0.32vw, 1.28rem)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  code:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "clamp(0.72rem, 0.67rem + 0.2vw, 0.82rem)"
    fontWeight: 400
    lineHeight: 1.95
    fontVariation: "'wdth' 87.5"
rounded:
  token: "3px"
  inline: "4px"
  control: "8px"
  comment: "10px"
  file: "12px"
  round: "50%"
spacing:
  gutter: "clamp(16px, 4.2vw, 48px)"
  container: "1240px"
  nav: "64px"
  section: "clamp(96px, 11vw, 168px)"
  column-gap: "clamp(40px, 5vw, 80px)"
  row: "16px"
  cell: "20px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.comment}"
    padding: "0 8px 0 18px"
    height: "52px"
  button-primary-lg:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.comment}"
    padding: "0 8px 0 22px"
    height: "60px"
  button-primary-on-terminal:
    backgroundColor: "{colors.terminal-fg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.comment}"
  diff-file:
    backgroundColor: "{colors.review-surface}"
    rounded: "{rounded.file}"
  diff-file-header:
    backgroundColor: "{colors.review-bar}"
    typography: "{typography.label}"
    height: "46px"
    padding: "0 16px"
  hunk-header:
    backgroundColor: "{colors.review-bar-strong}"
    textColor: "{colors.review-fg-2}"
    typography: "{typography.code}"
    padding: "5px 16px"
  diff-token:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.token}"
    padding: "0.08em 0.32em"
  review-comment:
    backgroundColor: "{colors.review-surface}"
    rounded: "{rounded.comment}"
    padding: "18px 20px 20px"
  inline-code:
    backgroundColor: "{colors.review-bar-strong}"
    rounded: "{rounded.inline}"
    padding: "0.1em 0.35em"
  nav:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    height: "64px"
---

# Design System: diditbreak website

## Overview

**Creative North Star: "The Code Review"**

The whole page is read as one pull request: a context-file change at the top, the agent's changed behaviour beneath it, then the checks, the evidence thread, and the merge box. Every component is borrowed from the grammar developers already read daily in review tools and terminals: line-number gutters, `+`/`−` markers, `@@` hunk headers, fold rows, diffstat blocks, CI check rows, inline review comments. Nothing is decorated; everything is a review artefact carrying real content.

The palette has no hue at all. Light sections are the review page (paper `#f5f5f5`, white files); dark sections are the terminal (near-black `#0a0a0a`, `#111111` files). Sections alternate between the two themes and every component re-derives its colours from the theme of the section it sits in, so the same diff, chip, or check row works on either. Change is shown by inversion, solid fills, outlines, and hatching, never by red and green.

Density is that of a working tool rather than a brochure: generous section breathing room (96 to 168px) around tight, information-dense panels with hairline rules. Motion is scroll-revealed and narrative: changes land line by line, checks spin and resolve, terminal output prints. With reduced motion or no JavaScript, every element is simply in its final state.

**Key Characteristics:**
- Pure neutrals, two themes (`data-theme="light"` review page, `data-theme="dark"` terminal), alternating by section.
- Diff grammar as the single component language.
- Inversion, outline, and hatch in place of colour for add/remove/absent.
- Wide-axis Archivo headings against narrowed Martian Mono code.
- Hairline borders and bar fills carry structure; one soft lift on file-like panels.
- Scroll reveals that never hide content before it has been seen.

## Colors

A strictly achromatic system: two themes of the same grey scale, inverted.

### Primary
- **Ink** (`ink`): text on the review page, the solid fill of the primary command chip, the inverted changed-token mark, filled diffstat blocks, check badges, and the selection highlight. On terminal sections the same roles are played by **Terminal Light** (`terminal-fg`); the system calls this role `--solid` / `--on-solid` and it always flips with the theme.

### Neutral (review page, light theme)
- **Paper** (`paper`): page background of light sections and the `html` canvas; also the text on solid ink fills.
- **White File** (`review-surface`): the body of diff files, terminals, check panels, comments and code blocks.
- **Bar Grey** (`review-bar`): file headers, fold rows, column headers, added/changed line bars.
- **Strong Bar Grey** (`review-bar-strong`): hunk headers, the gutter of added/changed lines, inline code chips.
- **Hairline** (`review-line`): row dividers, header underlines, the split-diff centre rule.
- **Strong Hairline** (`review-line-2`): outer borders of files, comments and panels; resting underline colour of text links.
- **Secondary Text** (`review-fg-2`): leads, descriptions, the removed side of a changed line.
- **Tertiary Text** (`review-fg-3`): line numbers, meta text, captions, provenance notes.

### Neutral (terminal, dark theme)
- **Terminal Black** (`ink`): dark section background.
- **Terminal Light** (`terminal-fg`), **Terminal Grey 2** (`terminal-fg-2`), **Terminal Grey 3** (`terminal-fg-3`): the three text levels.
- **Terminal File** (`terminal-surface`), **Terminal Bar** (`terminal-bar`), **Terminal Strong Bar** (`terminal-bar-strong`): the same surface/bar/hunk roles as on the review page.
- **Terminal Hairline** (`terminal-line`) and **Terminal Strong Hairline** (`terminal-line-2`): dividers and outer borders.

### Named Rules
**The No Hue Rule.** Every colour is a neutral grey. No accent, no tinted neutral, no red/green diff colouring, no gradients. This is a binding brand constraint.

**The Inversion Rule.** An addition is a solid fill, a removal is an outline, an absent line is hatched (strokes `#e2e2e2` on light, `#1f1f1f` on dark). The exact changed token inside a line is inverted (ink on paper becomes paper on ink).

**The Theme Follows the Section Rule.** Components never hard-code a theme. They read `--bg`, `--fg`, `--fg-2`, `--fg-3`, `--line`, `--line-2`, `--surface`, `--bar`, `--bar-strong`, `--solid`, `--on-solid` and `--shadow` from the nearest `data-theme`. The sticky nav adopts the theme of the section beneath it.

## Typography

**Display Font:** Archivo, variable, with the width axis set wide (`wdth` 112) (fallback ui-sans-serif, system-ui)
**Body Font:** Archivo at default width
**Label/Mono Font:** Martian Mono, width axis narrowed (`wdth` 87.5) (fallback ui-monospace, SFMono-Regular, Menlo)

**Character:** A heavy, wide, tightly tracked grotesk for statements against a compact, narrowed mono for everything the tool or the repository would print. The width contrast does the work colour would do elsewhere.

### Hierarchy
- **Display** (760, `display` clamp, 0.96, -0.038em, wide): the hero headline only; the closing merge-box headline uses the same weight and tracking at a slightly smaller clamp.
- **Headline** (720, `headline` clamp, 1.02, -0.03em, wide, balanced wrap, 12 to 14ch max): section headings.
- **Title** (720, `title` clamp, 1.2, -0.02em): review-comment headings and step titles.
- **Lead** (400, `lead` clamp, 1.55, secondary text colour, 40 to 50ch): the one paragraph under a section heading.
- **Body** (400, 1.0625rem, 1.6, pretty wrap): running text.
- **Label** (560 to 650, 0.75 to 0.9375rem, -0.01em, sentence case): file names, check titles, meta, table column heads, link labels. Strong labels sit at 620 to 650; links and chip actions at 560.
- **Code** (Martian Mono, `code` clamp, 1.95 in diffs, 1.85 in terminals): diff lines, hunk headers, terminal output, command chips, definition terms. Inline code inside prose drops to about 0.84 to 0.86em.

### Named Rules
**The Width Contrast Rule.** Headings are wide Archivo (`wdth` 112), code is narrow Martian Mono (`wdth` 87.5). Do not set headings at default width or code at full width.

**The Sentence Case Rule.** Labels, meta and column heads are sentence case with slightly negative tracking. There are no uppercase, letter-spaced labels anywhere in the system.

## Layout

A single centred column: `min(100% - 2 × gutter, 1240px)` with a fluid gutter (16 to 48px). Each section is full-bleed in its theme with vertical padding of `clamp(96px, 11vw, 168px)`. The nav is sticky at 64px; anchor scrolling is offset by nav height plus 16px.

Sections use asymmetric two-column grids built from fractional tracks: a copy column and an artefact column (roughly 4.6:7.4, 5:7, 4:8) separated by `48px` rows and `clamp(40px, 5vw, 80px)` columns. Heading blocks pair the headline (7fr) with the lead (5fr) aligned to the baseline end. In copy-plus-artefact sections the copy column can be sticky under the nav. Artefacts (diffs, terminals, tables) take the larger column or the full container width.

Responsive behaviour: two-column grids collapse to one column between 900 and 980px; the nav's text links hide below 1080px and its command chip below 720px; split diffs become unified (one column, old line above new) below 760px; the command chip drops its "Copy" label below 420px. Terminals swap to a pre-narrowed report on phones rather than scrolling sideways.

Inside panels, rows are 14 to 18px tall in padding with 16 to 22px horizontal insets, separated by hairlines.

## Elevation & Depth

Mostly flat. Structure comes from hairline borders and the three-step surface ladder (background, bar, strong bar, with white/near-black file bodies). File-like containers that stand for a whole artefact (diff files, the terminal, the checks panel, the measures table, the merge box) carry one soft, low, wide lift; nothing else does.

### Shadow Vocabulary
- **File lift, light** (`box-shadow: 0 1px 0 rgb(0 0 0 / 0.04), 0 28px 56px -28px rgb(0 0 0 / 0.22)`): every whole-artefact container on review sections.
- **File lift, dark** (`box-shadow: 0 1px 0 rgb(255 255 255 / 0.03), 0 28px 56px -28px rgb(0 0 0 / 0.9)`): the same containers on terminal sections.
- **Chip lift** (`box-shadow: 0 1px 0 rgb(0 0 0 / 0.06), 0 10px 24px -14px rgb(0 0 0 / 0.5)`, hover `0 16px 32px -16px rgb(0 0 0 / 0.55)` with a 1px rise): the command chip only.
- **Outline ring** (`box-shadow: inset 0 0 0 1.25 to 1.5px currentColor`): not depth but the "removed / not yet passed" state for diffstat blocks and status icons.

### Named Rules
**The One Lift Rule.** Only whole artefacts and the primary command chip are lifted. Comments, code blocks, rows and inline elements stay flat on hairlines.

## Shapes

Gently rounded rectangles in a strict ladder: 3px for inverted tokens, 4px for inline code chips, 7 to 8px for nested controls (chip action button, terminal comment callout, compact nav chip), 10px for review comments, code blocks and the command chip, 12px for whole artefacts (diff files, terminal, panels, tables). Status badges and spinners are full circles. Diffstat blocks are 8px squares with 1.5px corners. All containers clip their content (`overflow: hidden`) so header bars meet the radius cleanly. Borders are always 1px; dividers are 1px hairlines; stroked marks are 1.25 to 1.5px.

Icons are one custom set on a 16px grid with 1.5px round-capped, round-joined strokes in `currentColor`. The favicon repeats the system in miniature: an outlined bar above a solid bar on an ink square.

## Components

### Buttons
Tactile but quiet: one solid primary, everything else is an underlined link.
- **Shape:** 10px radius; 52px tall (60px large variant, 40px compact in the nav).
- **Primary (command chip):** solid `--solid` fill with `--on-solid` text, a dimmed mono `$` prompt, the command in mono 500, and a nested 7px-radius "Copy" action tinted 12% of the on-solid colour (20% on hover). Copying swaps the icon with a small pop.
- **Hover / Focus:** 1px rise and deeper chip lift over 260ms on the system ease-out. Focus is a 2px `--fg` outline at 3px offset with 3px radius, everywhere.
- **Secondary (text link with arrow):** 560 weight, underline in strong hairline colour that darkens to `currentColor` on hover; the trailing arrow nudges 2 to 3px.

### Diff File (signature component)
The page's one component language.
- **Container:** 12px radius, strong-hairline border, surface body, file lift.
- **Header:** 46px bar with a chevron, mono file name (600), a diffstat (`+n −n` plus five 8px blocks: solid for additions, outlined for removals), and right-aligned meta.
- **Split rows:** two columns, each a grid of line number (3.4em, tertiary, right-aligned), marker (1.6em, bold), code, and an optional flush-right aside (600) for deltas or verdicts. Added and changed lines get the bar fill with a strong-bar gutter; the old side of a changed line drops to secondary text; an absent side is hatched.
- **Hunk header:** strong-bar band with hairlines above and below, mono secondary text.
- **Fold row:** bar band with an unfold icon and tertiary 0.75rem text.
- **Changed token:** inverted mark with a 3px radius.
- **Unified block:** single-column variant for new files and listings.
- **Motion:** within a scope that has come into view, a change lands: marker slides in 8px, the line writes in from the gutter via a left-to-right clip, and the bar settles from surface colour. Under 760px rows render unified.

### Check Rows
The CI-checks panel and status lines. A bar-filled summary with a 32px solid circular badge, then rows each led by a 22px solid circular tick. While pending, the badge is an outlined ring with a spinner; checks resolve one after another (260ms apart after a 650ms wait). The "not yet passed" state is an outlined circle, the inverse of a passed check. The hero's status line uses the same spinner-then-result pattern.

### Review Comments
Explanations are written as review comments: 10px-radius surface boxes with a strong-hairline border, an author line (16px avatar glyph, 640-weight name, tertiary meta), a title, and secondary body text. A horizontal hairline can join a comment to the file it annotates; replies nest below in an inline thread on the section background.

### Terminal
A 12px file with a 42px bar (mono path left, shell name right) and mono output at 1.85 line height in secondary text, with the prompt line in full foreground. Inline annotations sit inside as 8px-radius sans callouts on the bar fill, max 62ch.

### Tables and Definition Lists
Tables are artefact panels: bar-filled column heads (0.75rem tertiary), strong-bar hunk-style group rows, 64px minimum rows separated by hairlines. Definition lists use a mono tertiary term column beside secondary-text descriptions, each row bounded by hairlines.

### Navigation
Sticky, 64px, background of the current section's theme so it inverts as the page passes between light and dark (360ms colour transition). A hairline appears only once scrolled. Brand is set in mono 600. Text links are 0.875rem secondary text darkening to foreground on hover. The compact command chip appears in the nav only once the hero's own chip has scrolled away.

### Motion
Scroll reveals are opt-in by a pre-paint `motion` class (set only without reduced motion) and only mark elements still below the fold as pending, so nothing above the fold ever hides. Vocabulary: **rise** (28px up with 8px blur, 900 to 1100ms), **apply** (left-to-right clip from 20% opacity, 820ms), **print** (instant per-line appearance on a 34ms stagger, for terminal output), **rule** (hairlines scale in from the left). Stagger is 70ms by default, 45ms in unified diff listings. One easing, `cubic-bezier(0.16, 1, 0.3, 1)`, for everything except linear spinners.

## Do's and Don'ts

### Do:
- **Do** express every new section as a review artefact: a diff file, a check panel, a review comment thread, a terminal, or a hairline table.
- **Do** mark additions with solid fill, removals with an outline, and absent lines with hatching; invert the exact changed token.
- **Do** place every component under a `data-theme` section and read colours from the theme variables, so it works on both review and terminal sections.
- **Do** alternate light and dark sections.
- **Do** set headings in wide Archivo (`wdth` 112, 720 to 760, -0.03 to -0.038em) and code in narrowed Martian Mono (`wdth` 87.5).
- **Do** keep reveals content-safe: visible by default, pending only below the fold, final state under reduced motion or without JavaScript.
- **Do** draw icons on the 16px, 1.5px-stroke, round-cap grid in `currentColor`.

### Don't:
- **Don't** introduce any hue: no accent colours, tinted greys, or red/green diff colouring.
- **Don't** use gradients, including gradient text or gradient backgrounds.
- **Don't** add uppercase letter-spaced labels or kickers above headings; the heading stands alone.
- **Don't** lift anything other than whole artefacts and the command chip; no shadowed cards for comments, rows or inline elements.
- **Don't** use radii outside the 3 / 4 / 8 / 10 / 12px ladder and full circles.
- **Don't** hard-code a theme colour inside a component that might sit in either section theme.
