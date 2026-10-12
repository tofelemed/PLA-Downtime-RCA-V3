import { containsPattern } from './production-event-v2.query';

describe('containsPattern (v2 event text search)', () => {
  it('wraps the text in wildcards', () => {
    expect(containsPattern('pump')).toBe('%pump%');
  });

  it('takes LIKE wildcards and the escape character literally', () => {
    expect(containsPattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
  });
});
