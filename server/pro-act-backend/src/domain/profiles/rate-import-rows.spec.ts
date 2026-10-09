import { readCsv } from './csv-table';
import { parseImport } from './rate-import-rows';

const row = (overrides: Record<string, unknown> = {}) => ({
  unitCode: 'unit100',
  productCode: 'HDPE-A',
  rate: '115.5',
  timebase: 'h',
  effectiveFrom: '2026-11-01T00:00:00Z',
  effectiveTo: '2026-12-01T00:00:00Z',
  ...overrides,
});

const HEADER =
  'unitCode,productCode,operatingMode,rate,timebase,effectiveFrom,effectiveTo';

describe('rate import rows (plan 2.2 step 4)', () => {
  it('parses JSON rows with the default operating mode', () => {
    const { rows, errors } = parseImport({ rows: [row()] }, false);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      line: 1,
      operatingMode: 'normal',
      rate: '115.5',
      timebase: 'h',
    });
    expect(rows[0].to?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('reports every invalid line with a code instead of stopping at the first', () => {
    const { rows, errors } = parseImport(
      {
        rows: [
          row({ unitCode: '' }),
          row({ rate: '-1' }),
          row({ timebase: 'week' }),
          row({ effectiveFrom: '2026-11-01 00:00' }),
          row({ effectiveTo: '2026-10-01T00:00:00Z' }),
          row(),
        ],
      },
      false,
    );
    expect(errors.map((e) => [e.line, e.code])).toEqual([
      [1, 'missing_code'],
      [2, 'invalid_rate'],
      [3, 'invalid_timebase'],
      [4, 'invalid_interval'],
      [5, 'invalid_interval'],
    ]);
    expect(rows).toHaveLength(1);
  });

  it('accepts a zero budget but not a zero sustained (MPC) rate', () => {
    expect(parseImport({ rows: [row({ rate: '0' })] }, false).errors).toEqual(
      [],
    );
    expect(
      parseImport({ rows: [row({ rate: '0' })] }, true).errors[0].code,
    ).toBe('invalid_rate');
  });

  it('refuses rows of one unit/product/mode that overlap each other (interval consistency)', () => {
    const { errors } = parseImport(
      {
        rows: [
          row({ effectiveTo: null }),
          row({
            effectiveFrom: '2026-12-01T00:00:00Z',
            effectiveTo: '2027-01-01T00:00:00Z',
          }),
          row({ productCode: 'HDPE-B' }),
        ],
      },
      false,
    );
    expect(errors).toEqual([
      expect.objectContaining({ line: 2, code: 'overlapping_rows' }),
    ]);
  });

  it('refuses an empty document', () => {
    expect(parseImport({ rows: [] }, false).errors[0].code).toBe('row_count');
  });

  it('reads CSV with quotes, CRLF and blank lines; lines are file lines', () => {
    const csv = [
      HEADER,
      'unit100,"HDPE ""A""",,100,h,2026-11-01T00:00:00Z,2026-12-01T00:00:00Z',
      '',
      'unit200,HDPE-B,normal,abc,h,2026-11-01T00:00:00Z,',
      '',
    ].join('\r\n');
    const { rows, errors } = parseImport({ csv }, false);
    expect(rows).toEqual([
      expect.objectContaining({ line: 2, productCode: 'HDPE "A"' }),
    ]);
    expect(errors).toEqual([
      expect.objectContaining({ line: 4, code: 'invalid_rate' }),
    ]);
  });

  it('reports an unterminated quote as invalid CSV', () => {
    expect(parseImport({ csv: 'unitCode\n"abc' }, false).errors[0].code).toBe(
      'invalid_csv',
    );
    expect(readCsv('')).toEqual([]);
  });
});
