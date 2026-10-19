import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'src', 'features', 'pla-analytics', 'dashboard');
const read = (file: string) => readFileSync(join(DIR, file), 'utf8');

describe('dashboard headings (QA_SHELL: "Downtime" section with a "Downtime" card)', () => {
  it('no card repeats the title of a dashboard section', () => {
    const sections = [...read('analytics-dashboard.tsx').matchAll(/<Section title="([^"]+)"/g)].map((match) => match[1]);
    const cards = readdirSync(DIR)
      .filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))
      .flatMap((file) => [...read(file).matchAll(/<AnalyticsCard\s+title="([^"]+)"/g), ...read(file).matchAll(/<AnalyticsCard\s*\n\s*title="([^"]+)"/g)].map((match) => match[1]));
    expect(sections.length).toBeGreaterThan(0);
    expect(cards.filter((title) => sections.includes(title))).toEqual([]);
  });
});
