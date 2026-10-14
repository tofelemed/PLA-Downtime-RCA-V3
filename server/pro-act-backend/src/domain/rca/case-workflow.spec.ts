import {
  independenceConflict,
  nextStatuses,
  statusOf,
  transitionOf,
  withInvestigators,
} from './case-workflow';

describe('RCA case workflow (RCA-01 / SME CA1)', () => {
  it('never jumps from Draft or Analysis to Closed', () => {
    expect(transitionOf('Draft', 'Closed')).toBeNull();
    expect(transitionOf('Analysis', 'Closed')).toBeNull();
    expect(transitionOf('Monitoring', 'Closed')).toBeNull();
  });

  it('accepting the investigation, requesting closure and closing carry their gates', () => {
    expect(transitionOf('Analysis', 'Monitoring')?.gates).toEqual([
      'investigation',
    ]);
    expect(transitionOf('Monitoring', 'Closure Review')?.gates).toEqual([
      'closure_request',
    ]);
    expect(transitionOf('Closure Review', 'Closed')?.gates).toEqual([
      'independent_approval',
    ]);
    expect(transitionOf('Closure Review', 'Monitoring')?.gates).toEqual([
      'independent_approval',
      'note',
    ]);
  });

  it('only Closure Review leads to Closed; a closed case reopens to Analysis', () => {
    expect(nextStatuses('Closure Review')).toEqual(['Monitoring', 'Closed']);
    expect(nextStatuses('Closed')).toEqual(['Analysis']);
  });

  it('legacy rows without a known status read as Draft', () => {
    expect(statusOf(null)).toBe('Draft');
    expect(statusOf('Whatever')).toBe('Draft');
    expect(statusOf('Published')).toBe('Published');
  });

  it('the approver is independent of author, lead, team and closure requester', () => {
    const parties = {
      createdBy: 'author',
      teamLeadId: 'lead',
      teamMemberIds: ['m1'],
      closureRequestedBy: 'requester',
      pastInvestigators: ['left-the-team'],
    };
    expect(independenceConflict('author', parties)).toBe('creator');
    expect(independenceConflict('lead', parties)).toBe('team_lead');
    expect(independenceConflict('m1', parties)).toBe('team_member');
    expect(independenceConflict('requester', parties)).toBe(
      'closure_requester',
    );
    expect(independenceConflict('left-the-team', parties)).toBe(
      'past_investigator',
    );
    expect(independenceConflict('reviewer', parties)).toBeNull();
  });

  it('the participant list only grows', () => {
    expect(withInvestigators(['a'], ['b', null, 'a', undefined])).toEqual(['a', 'b']);
    expect(withInvestigators(null, [])).toEqual([]);
  });
});
