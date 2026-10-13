import { tzdataProblems } from './tzdata-check';

describe('tzdataProblems (LA-13)', () => {
  it('the running ICU time-zone data knows Iran abolished DST in 2022', () => {
    expect(tzdataProblems()).toEqual([]);
  });

  it('reports a runtime that still applies Tehran summer time (tzdata older than 2022b)', () => {
    const staleOffsetAt = () => 270;
    expect(tzdataProblems(staleOffsetAt)).toEqual([
      expect.stringContaining('Asia/Tehran'),
    ]);
  });
});
