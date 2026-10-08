import * as fs from 'fs';
import * as path from 'path';

/**
 * Shape checks for the spec §19 acceptance fixtures T01–T46 authored in plan 0.1
 * (scripts/evidence/author-fixtures.py). Numerical fixtures carry `inputs` and `expected`
 * with every quantity as a decimal string (ACC09); only integer cardinalities such as
 * `rawEventCount` or `lines` are plain integers.
 */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const FIXTURE_DIR = __dirname;
const FIXTURE_FILE = /^T\d{2}\.json$/;
const FIXTURE_COUNT = 46;
const REQUIRED_KEYS = ['id', 'title', 'kind', 'spec_ref', 'owner_subphase'];
const KINDS = ['numerical', 'scenario'];
const COUNT_KEY = /(count|lines)$/i;

const files = fs
  .readdirSync(FIXTURE_DIR)
  .filter((file) => FIXTURE_FILE.test(file))
  .sort();

function readJson(file: string): Json {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8')) as Json;
}

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadFixture(file: string): JsonObject {
  const parsed = readJson(file);
  if (!isObject(parsed)) throw new Error(`${file} is not a JSON object`);
  return parsed;
}

/** Paths of JS numbers that should have been decimal strings. */
function nonStringQuantities(value: Json, keyPath: string, key: string): string[] {
  if (typeof value === 'number') {
    return Number.isInteger(value) && COUNT_KEY.test(key) ? [] : [`${keyPath}=${value}`];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => nonStringQuantities(item, `${keyPath}[${i}]`, ''));
  }
  if (isObject(value)) {
    return Object.entries(value).flatMap(([k, v]) =>
      nonStringQuantities(v, `${keyPath}.${k}`, k),
    );
  }
  return [];
}

describe('acceptance fixtures', () => {
  it(`has ${FIXTURE_COUNT} fixture files named T01..T${FIXTURE_COUNT}`, () => {
    const expected = Array.from(
      { length: FIXTURE_COUNT },
      (_, i) => `T${String(i + 1).padStart(2, '0')}.json`,
    );
    expect(files).toEqual(expected);
  });

  it('index.json lists every fixture exactly once', () => {
    const index = readJson('index.json');
    expect(isObject(index)).toBe(true);
    const listed = (index as JsonObject).fixtures;
    expect(Array.isArray(listed)).toBe(true);
    expect(listed).toHaveLength(FIXTURE_COUNT);
    expect([...(listed as string[])].sort()).toEqual(
      files.map((file) => file.replace(/\.json$/, '')),
    );
  });

  describe.each(files)('%s', (file) => {
    it('parses to an object whose id matches the file name', () => {
      const fixture = loadFixture(file);
      expect(fixture.id).toBe(file.replace(/\.json$/, ''));
    });

    it('has id, title, kind, spec_ref and owner_subphase', () => {
      const fixture = loadFixture(file);
      for (const key of REQUIRED_KEYS) {
        expect(typeof fixture[key]).toBe('string');
        expect(fixture[key]).not.toBe('');
      }
      expect(KINDS).toContain(fixture.kind);
    });

    it('is a numerical fixture with string quantities, or a scenario with given/action/assertion', () => {
      const fixture = loadFixture(file);
      if (fixture.kind === 'numerical') {
        expect(isObject(fixture.inputs)).toBe(true);
        expect(isObject(fixture.expected)).toBe(true);
        expect(typeof fixture.tolerance).toBe('string');
        expect(nonStringQuantities(fixture.inputs, 'inputs', '')).toEqual([]);
        expect(nonStringQuantities(fixture.expected, 'expected', '')).toEqual([]);
        return;
      }
      for (const key of ['given', 'action', 'assertion']) {
        expect(typeof fixture[key]).toBe('string');
      }
    });
  });
});
