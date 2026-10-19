import { columnWidths, wrapCell } from './pdf-wrap';

describe('PDF cell wrapping (QA re-test N4)', () => {
  it('wraps a cell at spaces within its column and cuts an over-long word', () => {
    const [width] = columnWidths([{ label: 'R', width: 1, align: 'left' }]);
    expect(wrapCell('a b', width)).toEqual(['a b']);
    expect(wrapCell('', width)).toEqual(['']);
    const narrow = wrapCell('MECH-GEARBOX · Gearbox failure', 60);
    expect(narrow.length).toBeGreaterThan(1);
    expect(narrow.join(' ').replace(/\s+/g, ' ')).toContain('Gearbox');
    expect(wrapCell('x'.repeat(200), 40).length).toBeLessThanOrEqual(4);
  });
});
