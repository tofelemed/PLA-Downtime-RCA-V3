import { durationText } from './duration-text';

describe('durationText (QA M6)', () => {
  it('reads like the screens: seconds, minutes, hours and minutes, days and hours', () => {
    expect(durationText(45)).toBe('45 s');
    expect(durationText(1800)).toBe('30 min');
    expect(durationText(61380)).toBe('17 h 03 min');
    expect(durationText(63000)).toBe('17 h 30 min');
    expect(durationText(7200)).toBe('2 h');
    expect(durationText(213000)).toBe('2 d 11 h');
  });

  it('refuses invalid input visibly', () => {
    expect(durationText(-1)).toBe('—');
    expect(durationText(Number.NaN)).toBe('—');
  });
});
