import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Radix `Select.Item` throws on an empty-string value ("A <Select.Item /> must have a value prop that is
 * not an empty string") and unmounts the whole page; the v1 Event Hub did this with its "No plans
 * available" item when a plant had no production plans. Empty-list placeholders are plain elements
 * outside the items, so this guards every select in the app against the same crash.
 */
const ROOT = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.tsx') && !name.endsWith('.test.tsx') ? [path] : [];
  });
}

describe('select placeholders (v1 Event Hub crash on a plant without plans)', () => {
  it('no SelectItem carries an empty value', () => {
    const offenders = sourceFiles(ROOT)
      .filter((path) => /<SelectItem[^>]*value=(""|''|\{''\}|\{""\})/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(ROOT, path).replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });
});
