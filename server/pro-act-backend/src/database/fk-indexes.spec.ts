import { readFileSync } from 'fs';
import { join } from 'path';
import { QueryRunner } from 'typeorm';
import { FkIndexes1794242000000 } from './migrations/1794242000000-FkIndexes';

const ANALYSIS = join(
  __dirname,
  '../../../../deploy/analysis/fk-without-index.txt',
);

function recorded(): { run: (m: 'up' | 'down') => Promise<string[]> } {
  return {
    run: async (m) => {
      const sql: string[] = [];
      const runner = {
        query: (q: string) => {
          sql.push(q);
          return Promise.resolve();
        },
      } as unknown as QueryRunner;
      await new FkIndexes1794242000000()[m](runner);
      return sql;
    },
  };
}

describe('FkIndexes1794242000000', () => {
  const pairs = readFileSync(ANALYSIS, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => {
      const [table, , column] = l.trim().split(/\s+/);
      return { table, column };
    });

  it('creates one unqualified index per analysed foreign key', async () => {
    const sql = await recorded().run('up');
    expect(pairs).toHaveLength(34);
    expect(sql).toHaveLength(34);
    for (const { table, column } of pairs) {
      expect(sql).toContain(
        `CREATE INDEX IF NOT EXISTS "IDX_${table}_${column}" ON "${table}" ("${column}")`,
      );
    }
    expect(sql.some((q) => q.includes('public.'))).toBe(false);
  });

  it('drops them all in down', async () => {
    const sql = await recorded().run('down');
    expect(sql).toHaveLength(34);
    expect(sql.every((q) => /^DROP INDEX IF EXISTS "IDX_/.test(q))).toBe(true);
    expect(sql.some((q) => q.includes('public.'))).toBe(false);
  });
});
