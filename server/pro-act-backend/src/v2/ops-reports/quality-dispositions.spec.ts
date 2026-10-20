import { toDispositionsView } from './quality-dispositions';

describe('quality dispositions (R4)', () => {
  it('counts the proposals awaiting a decision and the oldest one', () => {
    const view = toDispositionsView([
      {
        disposition_class: 'downgrade',
        state: 'approved',
        product_id: 'p',
        product_code: 'HD',
        uom: 't',
        lots: 2,
        quantity: '12.50000000',
        oldest: null,
      },
      {
        disposition_class: 'scrap',
        state: 'proposed',
        product_id: 'p',
        product_code: 'HD',
        uom: 't',
        lots: 3,
        quantity: '4',
        oldest: new Date('2027-03-02T00:00:00Z'),
      },
      {
        disposition_class: 'rework',
        state: 'proposed',
        product_id: 'p',
        product_code: 'HD',
        uom: 't',
        lots: 1,
        quantity: '1',
        oldest: new Date('2027-03-01T00:00:00Z'),
      },
    ]);
    expect(view.pending).toBe(4);
    expect(view.oldestPendingAt).toBe('2027-03-01T00:00:00.000Z');
    expect(view.groups[0]).toMatchObject({
      dispositionClass: 'downgrade',
      quantity: '12.5',
      lots: 2,
    });
  });

  it('has no pending date without proposals', () => {
    expect(toDispositionsView([]).oldestPendingAt).toBeNull();
  });
});
