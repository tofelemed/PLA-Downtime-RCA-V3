import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_RETAINED_PERIOD_DRAFTS, retainedPeriodDrafts, type RetainedPeriodDraft } from './retained-period-drafts';

const snapshot: RetainedPeriodDraft = { draft: { decisions: { candidate: { action: 'accept' } }, manual: [], dirty: true }, rowVersion: 4, baseRunId: 'run1' };
describe('scope-owned session-memory period drafts', () => {
  beforeEach(() => { retainedPeriodDrafts.setOwner(null); retainedPeriodDrafts.setOwner('user:plant:grants'); });
  it('keeps original concurrency metadata and isolates both owner and revision', () => {
    retainedPeriodDrafts.write('user:plant:grants', 'p1:r1', snapshot);
    expect(retainedPeriodDrafts.read('user:plant:grants', 'p1:r1')).toEqual(snapshot);
    expect(retainedPeriodDrafts.read('other:plant:grants', 'p1:r1')).toBeNull();
    expect(retainedPeriodDrafts.read('user:plant:grants', 'p1:r2')).toBeNull();
  });
  it.each(['other-user:plant:grants', 'user:other-plant:grants', 'user:plant:reduced-grants', null])('clears edits on identity, plant, grant or logout changes: %s', (owner) => {
    retainedPeriodDrafts.write('user:plant:grants', 'p1:r1', snapshot);
    retainedPeriodDrafts.setOwner(owner);
    expect(retainedPeriodDrafts.hasPending()).toBe(false);
    retainedPeriodDrafts.write('user:plant:grants', 'p1:r1', snapshot);
    expect(retainedPeriodDrafts.hasPending()).toBe(false);
  });
  it('removes clean saves/discards, while rejected dirty edits remain', () => {
    retainedPeriodDrafts.write('user:plant:grants', 'p1:r1', snapshot);
    retainedPeriodDrafts.write('user:plant:grants', 'p1:r1', { ...snapshot, draft: { ...snapshot.draft, dirty: false } });
    expect(retainedPeriodDrafts.hasPending()).toBe(false);
    retainedPeriodDrafts.write('user:plant:grants', 'p1:r1', snapshot);
    retainedPeriodDrafts.clear('user:plant:grants', 'p1:r1');
    expect(retainedPeriodDrafts.hasPending()).toBe(false);
  });
  it('bounds retention without evicting any unsaved draft and releases capacity explicitly', () => {
    for (let i = 0; i < MAX_RETAINED_PERIOD_DRAFTS; i++) retainedPeriodDrafts.write('user:plant:grants', `p${i}:r1`, snapshot);
    expect(retainedPeriodDrafts.atCapacity('user:plant:grants', 'new:r1')).toBe(true);
    expect(retainedPeriodDrafts.atCapacity('user:plant:grants', 'p0:r1')).toBe(false);
    retainedPeriodDrafts.write('user:plant:grants', 'new:r1', snapshot);
    expect(retainedPeriodDrafts.list('user:plant:grants')).toHaveLength(MAX_RETAINED_PERIOD_DRAFTS);
    expect(retainedPeriodDrafts.read('user:plant:grants', 'p0:r1')).toEqual(snapshot);
    retainedPeriodDrafts.clear('user:plant:grants', 'p0:r1');
    expect(retainedPeriodDrafts.atCapacity('user:plant:grants', 'new:r1')).toBe(false);
  });
});
