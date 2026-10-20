import { fallingMtbf } from './reliability-trend';

describe('reliability trend (R6)', () => {
  it('flags MTBF that fell in each of the last three months with a value', () => {
    expect(fallingMtbf(['500', '400', '300', '200'])).toBe(true);
    expect(fallingMtbf(['500', '400', null, '300', '200'])).toBe(true);
  });

  it('does not flag a rise, a flat month or too short a history', () => {
    expect(fallingMtbf(['500', '400', '450', '200'])).toBe(false);
    expect(fallingMtbf(['400', '400', '300', '200'])).toBe(false);
    expect(fallingMtbf(['400', '300', '200'])).toBe(false);
    expect(fallingMtbf([null, null])).toBe(false);
  });
});
