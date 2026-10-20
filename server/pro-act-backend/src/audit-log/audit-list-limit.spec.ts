import { AUDIT_LIST_MAX, auditListLimit } from './audit-log.service';

describe('auditListLimit (perf audit P07 / DB audit F10)', () => {
  it('keeps a page size between 1 and 500', () => {
    expect(auditListLimit('50')).toBe(50);
    expect(auditListLimit('500')).toBe(500);
  });

  it('caps larger pages instead of reading the whole table', () => {
    expect(auditListLimit('1000000')).toBe(AUDIT_LIST_MAX);
  });

  it('treats missing, zero, negative or non-numeric limits as the default', () => {
    for (const raw of [undefined, '', '0', '-5', 'all']) {
      expect(auditListLimit(raw)).toBe(AUDIT_LIST_MAX);
    }
  });
});
