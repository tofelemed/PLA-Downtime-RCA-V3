import { dueReminder } from './due-reminders';

const period = {
  periodId: 'p1',
  revisionId: 'r1',
  workflow: 'draft',
  overdue: true,
  rejections: 0,
};

/** SME R3: one reminder when a stage falls due — the preparer for submission, the checker for approval. */
describe('dueReminder', () => {
  it('owes nothing before the due time, on a data hold (not overdue) or once approved', () => {
    expect(dueReminder({ ...period, overdue: false })).toBeNull();
    expect(dueReminder({ ...period, workflow: 'approved' })).toBeNull();
  });

  it('a draft or not reconciled period past its submit due reminds the preparer', () => {
    expect(dueReminder(period)).toEqual({
      dedupeKey: 'sla:p1:due:submit:r1:0',
      stage: 'submit',
      recipient: 'preparer',
    });
    expect(
      dueReminder({ ...period, revisionId: null, workflow: 'none' })?.dedupeKey,
    ).toBe('sla:p1:due:submit:none:0');
  });

  it('a submitted (or stale) period past its approve due reminds the checker', () => {
    for (const workflow of ['in_review', 'stale']) {
      expect(dueReminder({ ...period, workflow })).toEqual({
        dedupeKey: 'sla:p1:due:approve:r1:0',
        stage: 'approve',
        recipient: 'checker',
      });
    }
  });

  it('a rejection starts a new cycle with its own key (new due time, one more reminder)', () => {
    expect(dueReminder({ ...period, rejections: 1 })?.dedupeKey).toBe(
      'sla:p1:due:submit:r1:1',
    );
  });
});
