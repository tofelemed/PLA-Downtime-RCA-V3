---
description: Redesign an existing application's frontend onto the Traverse design system (Day and Night tokens, shared shell, status semantics) in checkpointed phases, with build gates and evidence.
argument-hint: <app name> [frontend directory] [phase to start or resume at]
---

# Traverse redesign: $ARGUMENTS

Move this application's UI onto the Traverse design system. Arguments, in order: the app
name, the frontend directory (find it if not given), and the phase to start or resume at
(default 0). Behaviour does not change; only presentation does.

## Before anything

1. Load the `traverse-design-system` skill and read **all** of it: `SKILL.md`, especially
   §13 (field rules from the Instrumental rollout), and every file in `references/`. If the
   skill is not installed in this project, stop and tell the user to copy the folder into
   `.claude/skills/traverse-design-system/`. Never work from memory of it.
2. Read the project's `CLAUDE.md`, and its change tracker if there is one. Their rules on
   commits, deploys, documentation and shells override the defaults in this command.
3. Find the guide PDF (`Traverse_UI_Design_and_Development_Guide_R01.pdf`) and the pages for
   this module. The skill wins on values. The PDF's written page requirements win over its
   concept images, which set hierarchy and density only.
4. If resuming, read `docs/theme/migration-plan.md` first and continue from the recorded state.

## Non-negotiables

- **Behaviour is frozen.** Authentication, API calls, session handling, redirects, routes,
  form field names, input types, validation and data fetching stay as they are. Do not edit
  API clients, auth context, data hooks, middleware, framework config, env files or any
  backend. If a visual fix needs one of those, stop and ask.
- No new dependency without approval.
- Tokens only (skill §2 and §11). Never edit the copied `tokens.css` or `shadcn-bridge.css`.
  If no token fits, ask; never invent one.
- Absence is not health (skill §13.2). When a missing value renders as OK, Normal or green,
  fix it if the fix is display-only. If it needs a data or backend change, log it as a data
  issue for a separate decision.
- No commit, push, image build or deploy unless the user asks for it in that turn.
- Test sign-ins take credentials from environment variables at run time. Never write
  credentials, tokens or cookie values to a file, a log, a screenshot name or a report.
- Record every Lead decision verbatim and dated in the plan. A later decision may reverse an
  earlier one; keep both and mark which stands.

## Phases

Each phase ends with every gate green and a short report. At **STOP** checkpoints, halt until
the user or Lead answers; "complete all phases" does not approve open proposals.

### Phase 0: read, audit, plan. STOP (C1)

- Inventory the stack and its versions: styling system, theme mechanism, component library,
  chart library, icon sets, fonts.
- Count every raw colour per file: palette classes, hex, `rgb()`, `hsl()`, `oklch()`, inline
  styles, `dark:` utilities. Also count focus styles and every status or badge usage.
- On a production build at 1440 × 1024, measure the shell: sidebar width, header height,
  table row and input heights, radii, root font size. Capture baseline screenshots of every route.
- Run the existing build, typecheck and lint, and record pre-existing error counts as baselines.
- Write `docs/theme/migration-plan.md`: reading record, skill-against-tree audit, substitution
  table (old value to token), allow-list, risks found by measurement, and numbered decisions,
  each with a recommendation. Typical C1 questions: geometry the token files would change, the
  default theme and stored-value migration, a temporary alias file, buttons with no Traverse
  contract, statuses with no direct token, and colours that collide with reserved meanings
  (violet is AI only).
- Stop. Edit no application code before the decisions come back.

### Phase 1: token foundation

Copy `tokens.css` and `shadcn-bridge.css` byte-identical. Put the app's fonts, radii and
scrollbar width in its own base file. Add the temporary alias file (old names to
`var(--traverse-*)`, no literals). Wire the gates into `prebuild` (§13 rule 25). Re-measure the
shell: it must be unchanged unless C1 said otherwise.

### Phase 2: themes

Theme provider per skill §1 and §13 rule 24, and the header toggle per `components.md`. Prove
first paint with a throttled hard reload in each theme: zero wrong-theme frames, plus a
negative control with the theme script removed.

### Phase 3: shell and primitives. STOP (C4 review)

Sidebar, header, selected navigation, icons in their label's colour. Buttons, inputs, selects,
tables with the neutral header band from one shared class, badges including the neutral
badge, dialogs, toasts, tooltips, tabs, and a single focus indicator (§13 rule 23). Stop with
Day and Night screenshots of about ten key routes.

### Phase 4: charts and domain palettes. STOP

Chart chrome and series tokens. Status and domain palettes come from one constant file and are
rendered through one chip or badge component. Apply the absence handling of §13.2 to donuts,
lanes and filters. Stop with a swatch sheet and chart screenshots in both themes.

### Phase 5: token sweep

Convert every remaining raw colour. Prefer a codemod with a dry run that reports ambiguous
cases instead of guessing. Strip page-level focus rings. Delete the alias file, after which old
names fail the build.

### Phase 6: status semantics and data states

Apply §13.1 rules 3 to 7 everywhere, with one word per status. Implement every data state in
skill §9, so an error never reads as empty. Add reasons for disabled controls and truncated
values, the duration format, and replace emoji used as icons.

### Phase 7: behaviour regression

Prove nothing functional moved. Compare the sign-in request before and after (endpoint, field
names, payload shape; no secrets). Check the route guard and redirects, role-gated UI, and
that forms submit the same payloads.

### Phase 8: gates, acceptance, evidence

- All gates green.
- `docs/theme/README.md`: how theming is wired in this app, colour meaning, gates, and how to verify.
- `docs/theme/acceptance-record.md`: G01 to G12, each with method and result, plus what was not verified and why.
- Final Day and Night screenshot sets of every route at 1440 × 1024, and of key routes at
  1366 × 768 and 1920 × 1080.

## Verification, every phase

- A production build served from one origin with the real API behind it, with real scrollbars
  (§13 rule 28).
- Computed styles in both themes. Confirm the active theme before asserting. Let transitions
  and chart animations settle first (§13 rule 29).
- Look at every screenshot you take.
- Pace automated runs under the API rate limit.
- Report counts: what passed, what failed with its output, and what was not verified and why.

## Report at the end of each phase

Files changed, gate results against the baselines, checks run with counts, decisions needed,
and the next phase. Append to the project's change tracker if it keeps one.

## Feeding back

When this app produces a Lead decision or finds a defect that would recur in other modules,
propose it to the user as an addition to the skill's §13, with the date and the evidence. Do
not edit the skill silently.
