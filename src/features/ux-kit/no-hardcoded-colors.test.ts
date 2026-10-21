import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Colours come only from the semantic tokens (src/index.css, tailwind.config.ts — UX_AUDIT C-1):
 * `success / warning / info / neutral / danger`, `chart-1..8` and `state-*`. A hard-coded Tailwind palette
 * class, a raw `hsl()` / `rgb()` or a hex colour in feature code drifts from the tokens and breaks the
 * warning-vs-alarm rule (§5.8), so this scan fails on any new one. Generated shadcn files and tests are not
 * scanned; `hsl(var(--token))` is allowed.
 */
const ROOT = join(process.cwd(), 'src');
const SCANNED = ['features/', 'components/'];
const SKIPPED = ['components/ui/'];
/** User-chosen colours stored as data (an `<input type="color">` default), not UI styling. */
const ALLOWLIST = new Set([
  'features/admin/branding/branding-section.tsx', // the tenant's brand colours
  'features/master-data/rca/checklist-detail-page.tsx', // a checklist's user-picked colour
  'features/shell/brand-colors.ts', // turns the tenant's brand colours into tokens and a readable black / white
]);
const PALETTE =
  'amber|red|green|emerald|blue|sky|slate|gray|violet|yellow|orange|rose|lime|teal|indigo|zinc|neutral|stone|purple|pink|cyan|fuchsia';
const RAW = [
  {
    name: 'Tailwind palette colour class (use a semantic token)',
    pattern: new RegExp(`\\b(?:bg|text|border|fill|stroke|ring|from|via|to|divide|outline|decoration|accent|caret|placeholder|shadow)-(?:${PALETTE})-\\d{2,3}\\b`),
  },
  { name: 'raw hsl() / rgb() colour (use hsl(var(--token)))', pattern: /\b(?:hsla?|rgba?)\(\s*\d/ },
  { name: 'hex colour', pattern: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/ },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    const source = /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts');
    return source ? [path] : [];
  });
}

describe('colours come from the semantic tokens', () => {
  it('no palette classes, raw hsl()/rgb() or hex colours in src/features and src/components', () => {
    const offenders = sourceFiles(ROOT)
      .map((path) => relative(ROOT, path).replace(/\\/g, '/'))
      .filter((file) => SCANNED.some((dir) => file.startsWith(dir)))
      .filter((file) => !SKIPPED.some((dir) => file.startsWith(dir)) && !ALLOWLIST.has(file))
      .flatMap((file) => {
        const text = readFileSync(join(ROOT, file), 'utf8');
        return RAW.filter((raw) => raw.pattern.test(text)).map((raw) => `${file}: ${raw.name}`);
      });
    expect(offenders).toEqual([]);
  }, 30_000); // scans the source tree: slow when the whole suite runs in parallel
});
