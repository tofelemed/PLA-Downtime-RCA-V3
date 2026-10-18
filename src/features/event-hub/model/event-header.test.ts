import { describe, expect, it } from 'vitest';
import type { EventRevisionView } from '@/api/v2/types/events';
import { eventHeaderDescription } from './event-header';
import { latestRevisionNumber } from './source-facts';

const revision = (number: number) => ({ revision: number }) as EventRevisionView;

describe('event header revision number (owner finding: header "revision 7", History 1–6)', () => {
  it('shows the newest revision of the history, not the record version counter', () => {
    const revisions = [revision(1), revision(6), revision(3)];
    expect(eventHeaderDescription('Derived', latestRevisionNumber(revisions))).toBe('Derived · revision 6');
  });

  it('shows only the origin while the history is not loaded', () => {
    expect(latestRevisionNumber([])).toBeNull();
    expect(eventHeaderDescription('Derived', null)).toBe('Derived');
  });
});
