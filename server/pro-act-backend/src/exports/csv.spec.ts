import { csvCell, csvRow } from './csv';

describe('CSV cells (RFC 4180, NFR02 injection-safe)', () => {
  it.each([
    ['=HYPERLINK("http://x","y")', `"'=HYPERLINK(""http://x"",""y"")"`],
    ['+cmd|calc', "'+cmd|calc"],
    ['-2+3+cmd|calc', "'-2+3+cmd|calc"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tvalue', "'\tvalue"],
  ])('prefixes formula-leading text %j', (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it.each([
    ['-150', '-150'],
    ['0', '0'],
    ['1234.56789', '1234.56789'],
  ])('leaves the decimal %s untouched', (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it('quotes commas, quotes, line breaks and edge spaces; empty for null', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(' padded')).toBe('" padded"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(3)).toBe('3');
  });

  it('ends records with CRLF', () => {
    expect(csvRow(['a', null, 2])).toBe('a,,2\r\n');
  });
});
