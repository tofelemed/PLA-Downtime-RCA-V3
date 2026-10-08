import { instanceToPlain } from 'class-transformer';
import {
  DecimalString,
  decimalStringTransformer,
  toDecimalString,
} from './decimal-string.transformer';

class Sample {
  @DecimalString()
  amount: unknown;
}

describe('decimal strings', () => {
  it('serialises driver values as strings and empties as null', () => {
    expect(toDecimalString('1234.56780000')).toBe('1234.56780000');
    expect(toDecimalString(12.5)).toBe('12.5');
    expect(toDecimalString(10n)).toBe('10');
    expect(toDecimalString(null)).toBeNull();
    expect(toDecimalString(undefined)).toBeNull();
    expect(toDecimalString('')).toBeNull();
    expect(toDecimalString(Number.NaN)).toBeNull();
    expect(toDecimalString({})).toBeNull();
  });

  it('works as a TypeORM column transformer in both directions', () => {
    expect(decimalStringTransformer.to(7)).toBe('7');
    expect(decimalStringTransformer.from('7.25')).toBe('7.25');
    expect(decimalStringTransformer.from(null)).toBeNull();
  });

  it('works as a class-transformer property decorator on output', () => {
    const sample = new Sample();
    sample.amount = 99.9;
    expect(instanceToPlain(sample)).toEqual({ amount: '99.9' });
  });
});
