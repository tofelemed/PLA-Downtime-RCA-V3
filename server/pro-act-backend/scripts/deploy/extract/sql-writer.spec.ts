import { insertStatement, sqlFile } from './sql-writer';

describe('insertStatement', () => {
  it('renders Postgres literals for every value kind', () => {
    const row = {
      id: 'u1',
      name: "O'Brien",
      body: { a: 1 },
      active: true,
      created_at: new Date('2026-10-27T00:00:00Z'),
      tags: ['x'],
    };
    expect(insertStatement('units', Object.keys(row), row)).toBe(
      "INSERT INTO units (id, name, body, active, created_at, tags) VALUES ('u1', 'O''Brien', " +
        `'{"a":1}'::jsonb, true, '2026-10-27T00:00:00.000Z'::timestamptz, ARRAY['x']) ON CONFLICT DO NOTHING;`,
    );
  });

  it('renders nulls, numbers and false', () => {
    const row = { a: null, b: 2.5, c: false, d: undefined };
    expect(insertStatement('t', ['a', 'b', 'c', 'd'], row)).toBe(
      'INSERT INTO t (a, b, c, d) VALUES (NULL, 2.5, false, NULL) ON CONFLICT DO NOTHING;',
    );
  });

  it('uses the column types: jsonb text, jsonb arrays, numeric text, timestamp text, typed arrays', () => {
    const row = {
      cfg: '{"x": "it\'s"}',
      list: [1, 2],
      qty: '12.500',
      at: '2026-10-27 01:02:03.456789+00',
      ids: [],
    };
    const types = {
      cfg: { dataType: 'jsonb', udtName: 'jsonb' },
      list: { dataType: 'jsonb', udtName: 'jsonb' },
      qty: { dataType: 'numeric', udtName: 'numeric' },
      at: { dataType: 'timestamp with time zone', udtName: 'timestamptz' },
      ids: { dataType: 'ARRAY', udtName: '_uuid' },
    };
    expect(insertStatement('t', Object.keys(row), row, types)).toBe(
      `INSERT INTO t (cfg, list, qty, at, ids) VALUES ('{"x": "it''s"}'::jsonb, '[1,2]'::jsonb, 12.500, ` +
        "'2026-10-27 01:02:03.456789+00'::timestamptz, ARRAY[]::uuid[]) ON CONFLICT DO NOTHING;",
    );
  });

  it('quotes reserved and mixed-case identifiers', () => {
    expect(insertStatement('t', ['order', 'Key'], { order: 1, Key: 'k' })).toBe(
      `INSERT INTO t ("order", "Key") VALUES (1, 'k') ON CONFLICT DO NOTHING;`,
    );
  });

  it('refuses a value it cannot render', () => {
    expect(() => insertStatement('t', ['b'], { b: Buffer.from('x') })).toThrow(
      /t\.b/,
    );
    expect(() => insertStatement('t', ['n'], { n: Number.NaN })).toThrow(
      /t\.n/,
    );
  });
});

describe('sqlFile', () => {
  it('wraps the statements in the search path and one transaction', () => {
    expect(sqlFile('-- header', ['INSERT 1;', 'INSERT 2;'])).toBe(
      '-- header\nSET search_path = forge, public;\nBEGIN;\nINSERT 1;\nINSERT 2;\nCOMMIT;\n',
    );
  });
});
