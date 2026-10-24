import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'src', 'features', 'pla-analytics', 'dashboard');
const read = (file: string) => readFileSync(join(DIR, file), 'utf8');
const sources = readdirSync(DIR).filter((file) => file.endsWith('.tsx') && !file.includes('.test.'));

describe('dashboard headings (QA_SHELL: "Downtime" section with a "Downtime" card)', () => {
  it('no card repeats its section name', () => {
    const sectionTitles = sources.flatMap((file) => [...read(file).matchAll(/<KpiSection\s+title="([^"]+)"/g)].map((match) => match[1]));
    const cardTitles = sources.flatMap((file) => [...read(file).matchAll(/<(?!KpiSection\b)[A-Z]\w*\s+(?:[^>]*\s)?title="([^"]+)"/g)].map((match) => match[1]));
    expect(sectionTitles).toEqual(expect.arrayContaining(['Reconciliation', 'Latest loss events', 'Downtime', 'Asset reliability']));
    expect(cardTitles.filter((title) => sectionTitles.includes(title))).toEqual([]);
  });
});
