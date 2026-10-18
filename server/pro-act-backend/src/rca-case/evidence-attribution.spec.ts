import { RcaEvidenceItemDto } from '../v2/rca/rca-case-items-v2.dto';
import { attributeEvidence, evidenceAssignees } from './evidence-attribution';
import { readEvidence } from './rca-case-json';

const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const other = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const now = new Date('2026-10-18T08:00:00Z');
const item = (fields: Partial<RcaEvidenceItemDto>): RcaEvidenceItemDto =>
  Object.assign(new RcaEvidenceItemDto(), {
    title: 'Bearing photo',
    ...fields,
  });

describe('evidence attribution (UX F-11)', () => {
  it('records who verified an item and when, ignoring values sent by the client', () => {
    const [stamped] = attributeEvidence(
      [],
      [
        item({
          id: 'ev-1',
          verified: true,
          verifiedBy: other,
          verifiedAt: '2020-01-01',
        }),
      ],
      { userId, now },
    );
    expect(stamped).toMatchObject({
      verified: true,
      verifiedBy: userId,
      verifiedAt: now.toISOString(),
    });
  });

  it('keeps the recorded verifier while the item stays verified', () => {
    const previous = readEvidence(
      JSON.stringify([
        {
          id: 'ev-1',
          title: 'x',
          verified: true,
          verifiedBy: other,
          verifiedAt: '2026-10-01T00:00:00.000Z',
        },
      ]),
    );
    const [kept] = attributeEvidence(
      previous,
      [item({ id: 'ev-1', verified: true })],
      { userId, now },
    );
    expect(kept).toMatchObject({
      verifiedBy: other,
      verifiedAt: '2026-10-01T00:00:00.000Z',
    });
  });

  it('clears the verifier when the item is not verified', () => {
    const [cleared] = attributeEvidence(
      [],
      [item({ id: 'ev-1', verified: false, verifiedBy: other })],
      { userId, now },
    );
    expect(cleared).toMatchObject({ verifiedBy: null, verifiedAt: null });
  });

  it('lists distinct task assignees to validate', () => {
    expect(
      evidenceAssignees([
        item({ taskAssigneeId: other }),
        item({ taskAssigneeId: other }),
        item({ taskAssigneeId: null }),
        item({}),
      ]),
    ).toEqual([other]);
    expect(evidenceAssignees(undefined)).toEqual([]);
  });

  it('reads the assignee and verifier back (null for items stored before U3)', () => {
    const [stored, legacy] = readEvidence(
      JSON.stringify([
        {
          id: 'ev-1',
          title: 'a',
          taskAssigneeId: other,
          verified: true,
          verifiedBy: userId,
          verifiedAt: '2026-10-18T08:00:00.000Z',
        },
        { id: 'ev-2', title: 'b', verified: true },
      ]),
    );
    expect(stored).toMatchObject({
      taskAssigneeId: other,
      verifiedBy: userId,
      verifiedAt: '2026-10-18T08:00:00.000Z',
    });
    expect(legacy).toMatchObject({
      taskAssigneeId: null,
      verifiedBy: null,
      verifiedAt: null,
    });
  });
});
