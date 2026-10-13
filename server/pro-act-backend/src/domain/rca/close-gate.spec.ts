import { closeBlockers } from './close-gate';

describe('closeBlockers (RCA-01)', () => {
  it('a case with a root cause and every action done or cancelled may close', () => {
    expect(
      closeBlockers({
        rootCause: 'Misalignment after seal change',
        actionStatuses: ['done', 'cancelled'],
      }),
    ).toEqual([]);
  });

  it('a case without actions may close once its root cause is written', () => {
    expect(
      closeBlockers({ rootCause: 'Operator error', actionStatuses: [] }),
    ).toEqual([]);
  });

  it('a missing or blank root cause blocks closing', () => {
    expect(closeBlockers({ rootCause: '  ', actionStatuses: [] })).toEqual([
      'ROOT_CAUSE_MISSING',
    ]);
    expect(closeBlockers({ rootCause: null, actionStatuses: [] })).toEqual([
      'ROOT_CAUSE_MISSING',
    ]);
  });

  it('an open or running action blocks closing', () => {
    expect(
      closeBlockers({
        rootCause: 'Misalignment',
        actionStatuses: ['done', 'in_progress', 'open'],
      }),
    ).toEqual(['ACTIONS_NOT_DONE']);
  });
});
