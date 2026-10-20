import { toRestatementRow } from './restatements-report';

const row = {
  period_id: 'p1',
  unit_id: 'u1',
  unit_name: 'Line 1',
  local_date: '2027-03-01',
  shift_name: 'A',
  revision: 2,
  approved_at: new Date('2027-03-05T08:00:00Z'),
  after_close: true,
  treatment: 'correction',
  posting_date: '2027-04-02',
  uom: 't',
  good_before: '850.00000000',
  good_after: '835.50000000',
};

describe('restatements (R3)', () => {
  it('reports the good-output change of the replacing revision', () => {
    expect(toRestatementRow(row)).toMatchObject({
      revision: 2,
      afterClose: true,
      treatment: 'correction',
      goodBefore: '850',
      goodAfter: '835.5',
      goodDelta: '-14.5',
      approvedAt: '2027-03-05T08:00:00.000Z',
    });
  });

  it('has no change when either run has no totals', () => {
    expect(
      toRestatementRow({ ...row, good_before: null }).goodDelta,
    ).toBeNull();
  });
});
