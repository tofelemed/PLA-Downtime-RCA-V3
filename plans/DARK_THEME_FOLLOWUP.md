# Dark theme: follow-up

Branch `feat/dark-theme`. The token sweep is complete: `src/features/ux-kit/no-hardcoded-colors.test.ts` now scans
`features/ components/ pages/ app/ contexts/ hooks/ lib/` and also bans `bg-white` / `text-black` etc. No file in
those folders has a hard-coded colour. What is left:

- [ ] Visual QA of signed-in pages in dark: shell, dashboard, tables, charts, RCA event diagram (React Flow), dialogs,
      toasts. Not done in the dark-theme pass: the dev backend only allows CORS from `:8070`, which another session
      was using.
- [ ] Sidebar redesign: use `text-sidebar-section-label` for section labels and `border-sidebar-border` /
      `bg-sidebar`. Light `#94a3b8` labels are 2.6:1 on white, below WCAG AA for text (owner decision needed).
      `sidebar-group.tsx` still uses `text-muted-foreground`, which is AA.
- [ ] Brand primary colour (`use-brand-appearance.ts`) is set inline on `<html>`, so it overrides the dark
      `--primary` too. Decide whether a stored brand colour applies in dark, or whether it should get a dark variant.
- [ ] `src/components/ui/toast.tsx` (generated) keeps its own `red-*` classes on the destructive toast. They are
      readable in both themes; leave them unless the toast gets restyled.
- [ ] `index.html` `<meta name="theme-color" content="#2563eb">` (browser chrome colour) does not follow the theme.
- [ ] Charts that set their own Recharts `tick` / `stroke` props would bypass the global chrome rules in
      `src/index.css`. None do today; new charts should keep using the `chart-*` tokens.
