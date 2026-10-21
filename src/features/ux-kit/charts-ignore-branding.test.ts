import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Charts, graphs and trends take their colours from the chart palette (`--chart-1..8`, ≥ 3:1 on white), the
 * unit-state tokens (`--state-*`) and the status tokens (`--success`, `--warning`, `--destructive`), never from
 * the theme colours a plant's branding overrides (`--primary`, `--ring`, `--brand-secondary`): owner
 * 21 Oct 2026, chart colours follow the colour standard, not the branding.
 */
const ROOT = join(process.cwd(), 'src');
const BRAND_TOKENS = /var\(--(?:primary|primary-foreground|ring|brand-secondary)\)|\b(?:fill|stroke)-primary\b/;

function chartFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'ui' ? [] : chartFiles(path);
    if (!/\.tsx?$/.test(name) || /\.(test|spec)\.tsx?$/.test(name)) return [];
    return /from ['"]recharts['"]/.test(readFileSync(path, 'utf8')) ? [path] : [];
  });
}

describe('charts ignore the branding colours', () => {
  it('no chart uses a theme colour that branding overrides', () => {
    const files = chartFiles(ROOT);
    expect(files.length).toBeGreaterThan(5);
    const offenders = files
      .filter((path) => BRAND_TOKENS.test(readFileSync(path, 'utf8')))
      .map((path) => relative(ROOT, path).split('\\').join('/'));
    expect(offenders).toEqual([]);
  });
});
