import { ReportDocument } from '../../../exports/report/report-document';
import { inReportingCurrency } from './document-parts';

const table = (rows: Array<Array<string | number | null>>) => ({
  kind: 'table' as const,
  title: 'Top 5 losses (value)',
  columns: [
    { label: 'Reason', type: 'text' as const },
    { label: 'Value', type: 'number' as const },
    { label: 'Currency', type: 'text' as const },
  ],
  rows,
});

const documentOf = (sections: ReportDocument['sections']) =>
  ({ kind: 'daily', title: 'Daily', sections }) as unknown as ReportDocument;

describe('report exports in one reporting currency (settings audit, 21 Oct 2026)', () => {
  it('keeps the rows in the chosen currency and the rows without one; never converts', () => {
    const out = inReportingCurrency(
      documentOf([
        table([
          ['Gearbox', 1200, 'USD'],
          ['Gearbox', 50_400_000_000, 'IRR'],
          ['Not valued', null, null],
        ]),
      ]),
      'IRR',
    );
    expect(out.sections[0]).toMatchObject({
      rows: [
        ['Gearbox', 50_400_000_000, 'IRR'],
        ['Not valued', null, null],
      ],
    });
  });

  it('says when nothing was reported in the chosen currency', () => {
    const out = inReportingCurrency(
      documentOf([table([['Gearbox', 1200, 'USD']])]),
      'IRR',
    );
    expect(out.sections[0]).toMatchObject({
      rows: [],
      note: 'Not reported in IRR.',
    });
  });

  it('leaves tables without a currency column alone', () => {
    const quantity = {
      kind: 'table' as const,
      title: 'Top 5 losses (quantity)',
      columns: [{ label: 'Unit', type: 'text' as const }],
      rows: [['t']],
    };
    expect(inReportingCurrency(documentOf([quantity]), 'USD').sections[0]).toBe(
      quantity,
    );
  });
});
