import { describe, expect, it } from 'vitest';
import { actionLabel, entityLabel } from '../components/audit-columns';
import { labelledCounts } from './audit-counts';

describe('audit counts by label (QA_SHELL)', () => {
  it('record types that read the same are one row; sign-ins read "User session"', () => {
    const rows = [{ key: 'User', count: 13 }, { key: 'USER', count: 272 }, { key: 'Exports', count: 2 }, { key: 'Export', count: 1 }];
    expect(labelledCounts(rows, entityLabel)).toEqual([
      { label: 'User session', count: 272 },
      { label: 'User', count: 13 },
      { label: 'Export', count: 3 },
    ]);
  });

  it('actions read as words, never raw upper-case verbs', () => {
    expect(labelledCounts([{ key: 'CREATE', count: 2 }, { key: 'LOGIN', count: 5 }], actionLabel)).toEqual([
      { label: 'Signed in', count: 5 },
      { label: 'Created', count: 2 },
    ]);
  });
});
