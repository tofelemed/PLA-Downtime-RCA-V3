import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plant settings (calendar, digits, time zone, week start) must change every screen at once, so dates,
 * times and numbers are formatted only by the plant-aware helpers: `src/lib/dates` and
 * `src/features/ux-kit/format`. A raw browser-locale call elsewhere ignores the settings (and the plant
 * zone), so this scan fails on any new one. Generated shadcn files and tests are not scanned.
 */
const ROOT = join(process.cwd(), 'src');
const HELPERS = ['lib/dates/', 'features/ux-kit/format/', 'components/ui/'];
const RAW = [
  { name: 'toLocale*String()', pattern: /\.toLocale(?:Date|Time)?String\(/ },
  { name: 'new Intl.DateTimeFormat / NumberFormat', pattern: /new Intl\.(?:DateTimeFormat|NumberFormat)\(/ },
  { name: 'toISOString() sliced into a date', pattern: /\.toISOString\(\)\.(?:slice|substring|substr|split)\(/ },
  { name: 'hard-coded locale', pattern: /['"]en-(?:US|GB|CA)['"]/ },
  { name: 'date-fns formatting', pattern: /from ['"]date-fns/ },
  // numbers: the digits setting (Latin / Persian digits and separators) applies to every displayed number
  { name: 'toFixed() / toPrecision() number text', pattern: /\.to(?:Fixed|Precision)\(/ },
  { name: 'hand-rolled thousands grouping', pattern: /\(\\d\{3\}\)\+/ },
];
/**
 * JSX text that renders a number directly (`{rows.length}`, `{index + 1}`) skips the digits setting:
 * wrap it in `useNumberFormat().number(...)`. Attribute values (`={...}`) and template parts (`${...}`)
 * are not matched, so aria labels and keys stay as they are.
 */
const RAW_JSX = [
  { name: 'JSX renders {x.length} / {x.size} directly', pattern: /(?<![=\w$])\{\s*[\w.?!]+\.(?:length|size)\s*\}/ },
  { name: 'JSX renders {i + 1} directly', pattern: /(?<![=\w$])\{\s*\w+ \+ 1\s*\}/ },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    const source = /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts');
    return source ? [path] : [];
  });
}

describe('dates and numbers go through the plant-aware helpers', () => {
  it('no raw browser-locale formatting outside src/lib/dates and ux-kit/format', () => {
    const offenders = sourceFiles(ROOT)
      .map((path) => relative(ROOT, path).replace(/\\/g, '/'))
      .filter((file) => !HELPERS.some((helper) => file.startsWith(helper)))
      .flatMap((file) => {
        const text = readFileSync(join(ROOT, file), 'utf8');
        const rules = file.endsWith('.tsx') ? [...RAW, ...RAW_JSX] : RAW;
        return rules.filter((raw) => raw.pattern.test(text)).map((raw) => `${file}: ${raw.name}`);
      });
    expect(offenders).toEqual([]);
  }, 30_000); // scans the source tree: slow when the whole suite runs in parallel
});
