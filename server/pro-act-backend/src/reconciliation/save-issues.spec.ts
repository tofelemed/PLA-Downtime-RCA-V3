import { Dec } from '../domain/actuals/decimal';
import { shortfallCapOf } from './save-issues';

describe('shortfallCapOf (conservation cap of production loss events)', () => {
  const declaredShortfalls = new Map([['pl1', new Dec(50)]]);

  it('applies to a declared run', () => {
    expect(shortfallCapOf({ lossBasis: 'declared', declaredShortfalls })).toBe(
      declaredShortfalls,
    );
  });

  it('a computed run citing a production loss event is not capped by it', () => {
    expect(
      shortfallCapOf({ lossBasis: 'computed', declaredShortfalls }),
    ).toBeUndefined();
  });
});
