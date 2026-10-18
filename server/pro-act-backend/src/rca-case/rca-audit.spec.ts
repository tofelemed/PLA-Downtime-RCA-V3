import {
  changedFields,
  changedValues,
  childAudit,
  snapshotHash,
} from './rca-audit';

describe('RCA field history helpers (item 2)', () => {
  const before = {
    id: 'a1',
    rcaId: 'c1',
    status: 'open',
    dueDate: new Date('2027-01-01T00:00:00Z'),
    rootCause: 'Seal',
    logicTree: '[{"id":"n1"}]',
    rowVersion: 3,
    updatedAt: new Date('2027-01-01T00:00:00Z'),
  };

  it('lists changed top-level fields, ignoring bookkeeping and null versus undefined', () => {
    const after = {
      ...before,
      status: 'done',
      dueDate: new Date('2027-01-01T00:00:00Z'),
      logicTree: '[{"id":"n2"}]',
      ownerId: undefined,
      description: null,
      rowVersion: 4,
      updatedAt: new Date(),
    };
    expect(changedFields(before, after)).toEqual(['logicTree', 'status']);
  });

  it('keeps small scalar values and text lengths, never the JSON content', () => {
    const after = { ...before, status: 'done', rootCause: 'Seal flush lost' };
    const fields = changedFields(before, after);
    expect(changedValues(fields, before, after)).toEqual({
      status: { from: 'open', to: 'done' },
      rootCauseLength: { from: 4, to: 15 },
    });
    expect(changedValues(['logicTree'], before, after)).toEqual({});
  });

  it('a created row changes every field it has; dates come out as ISO text', () => {
    const fields = changedFields(null, before);
    expect(fields).toEqual([
      'dueDate',
      'id',
      'logicTree',
      'rcaId',
      'rootCause',
      'status',
    ]);
    expect(changedValues(fields, null, before).dueDate).toEqual({
      from: null,
      to: '2027-01-01T00:00:00.000Z',
    });
  });

  it('hashes ignore bookkeeping fields and key order', () => {
    const moved = { ...before, rowVersion: 9, updatedAt: new Date() };
    expect(snapshotHash(moved)).toBe(snapshotHash(before));
    expect(snapshotHash({ ...before, status: 'done' })).not.toBe(
      snapshotHash(before),
    );
    expect(snapshotHash(null)).toBeNull();
  });

  it('a child entry carries its case id, revision and reason', () => {
    const entry = childAudit(
      'rca_action',
      'updated',
      { before, after: { ...before, status: 'cancelled', rowVersion: 4 } },
      'duplicate',
    );
    expect(entry).toMatchObject({
      entityType: 'rca_action',
      entityId: 'a1',
      caseId: 'c1',
      action: 'updated',
      revision: 4,
      reason: 'duplicate',
    });
  });
});
