import { mapAttributes } from './attribute-mapper';
import { FieldRule } from './field-rule';

const rules: FieldRule[] = [
  {
    sourceAttr: 'GoodQty',
    aliases: ['Quantity'],
    targetField: 'quantity',
    type: 'number',
  },
];
const times = { start: new Date('2026-10-15T00:00:00Z'), end: null };
const map = (attributes: Record<string, unknown>) =>
  mapAttributes(rules, attributes, times);

describe('mapped quantity source unit', () => {
  it('preserves the explicit unit of the selected alias without converting its value', () => {
    expect(
      map({ Quantity: { Value: '9.6', UnitsAbbreviation: 't' } }).columns,
    ).toEqual({ quantity: 9.6, quantityUom: 't' });
  });

  it('uses the primary attribute and its unit when both it and an alias are present', () => {
    expect(
      map({
        GoodQty: { Value: 9600, UnitsAbbreviation: 'kg' },
        Quantity: { Value: 9.6, UnitsAbbreviation: 't' },
      }).columns,
    ).toEqual({ quantity: 9600, quantityUom: 'kg' });
  });

  it('does not borrow an alias unit when the selected primary value has no unit', () => {
    expect(
      map({ GoodQty: 9.6, Quantity: { Value: 9.6, UnitsAbbreviation: 't' } })
        .columns,
    ).toEqual({ quantity: 9.6 });
  });

  it('keeps zero quantities and their explicit units', () => {
    expect(
      map({ Quantity: { Value: 0, UnitsAbbreviation: 'kg' } }).columns,
    ).toEqual({ quantity: 0, quantityUom: 'kg' });
  });

  it('never infers a unit from the attribute name or another attribute', () => {
    expect(
      map({
        Quantity: 9.6,
        Unit: 't',
        Cost: { Value: 10, UnitsAbbreviation: 'USD' },
      }).columns,
    ).toEqual({ quantity: 9.6 });
  });

  it('does not retain a unit when quantity conversion fails', () => {
    const result = map({ Quantity: { Value: 'bad', UnitsAbbreviation: 't' } });
    expect(result.columns).toEqual({});
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'TYPE_MISMATCH' }),
    ]);
  });

  it.each([undefined, null, '', '  ', 42, 'x'.repeat(33)])(
    'leaves absent or unusable unit metadata unset: %p',
    (unit) => {
      expect(
        map({ Quantity: { Value: 9.6, UnitsAbbreviation: unit } }).columns,
      ).toEqual({ quantity: 9.6 });
    },
  );
});
