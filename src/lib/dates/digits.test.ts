import { describe, expect, it } from 'vitest';
import { formatDuration } from './format-duration';
import { localizeNumber, toLatinNumber } from './digits';

describe('localizeNumber', () => {
  it('keeps Latin number text unchanged', () => {
    expect(localizeNumber('-12,345.68 t')).toBe('-12,345.68 t');
    expect(localizeNumber('87.5 %', 'latin')).toBe('87.5 %');
  });

  it('writes Persian digits with the Persian decimal (U+066B) and group (U+066C) separators', () => {
    expect(localizeNumber('12,345.68', 'persian')).toBe('۱۲٬۳۴۵٫۶۸');
    expect(localizeNumber('1,234,567', 'persian')).toBe('۱٬۲۳۴٬۵۶۷');
    expect(localizeNumber('-0.5', 'persian')).toBe('-۰٫۵');
    expect(localizeNumber('87.5 %', 'persian')).toBe('۸۷٫۵ %');
    expect(localizeNumber('-12.5 %', 'persian')).toBe('-۱۲٫۵ %');
  });

  it('leaves punctuation that is not between two digits alone', () => {
    expect(localizeNumber('3 stops, 2 assets.', 'persian')).toBe('۳ stops, ۲ assets.');
    expect(localizeNumber('—', 'persian')).toBe('—');
  });
});

describe('toLatinNumber', () => {
  it('reads Persian and Arabic-Indic digits and separators typed by a user as Latin', () => {
    expect(toLatinNumber('۱۲٬۳۴۵٫۶۸')).toBe('12,345.68');
    expect(toLatinNumber('٤٫٥')).toBe('4.5');
    expect(toLatinNumber('12.5')).toBe('12.5');
  });
});

describe('durations in Persian digits', () => {
  it('writes every unit of the one duration format in Persian digits', () => {
    expect(formatDuration(216_000)).toBe('2 d 12 h');
    expect(formatDuration(216_000, { digits: 'persian' })).toBe('۲ d ۱۲ h');
    expect(formatDuration(12_300, { digits: 'persian' })).toBe('۳ h ۲۵ min');
    expect(formatDuration(2520, { digits: 'persian' })).toBe('۴۲ min');
  });
});
