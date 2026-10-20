import { writeFileSync } from 'fs';
import { join } from 'path';
import { resolvePdfFonts } from '../pdf/pdf-fonts';
import { ExportPresentation } from '../pdf/pdf-model';
import { ReportDocument } from './report-document';
import { reportLogo } from './report-pdf-kit';
import { writeReportPdf } from './report-pdf';
import { numFmtOf, sheetName, writeReportXlsx, xlsxValue } from './report-xlsx';

const presentation: ExportPresentation = {
  plantName: 'Marun Petrochemical · HDPE',
  timezone: 'Asia/Tehran',
  calendar: 'gregorian',
  digits: 'latin',
  currency: 'USD',
};

export const SAMPLE: ReportDocument = {
  kind: 'daily',
  title: 'Daily production report',
  subtitle:
    'Output against plan, quality, losses and event coding of the chosen production days',
  from: '2027-03-01T02:30:00.000Z',
  to: '2027-03-02T02:30:00.000Z',
  units: ['HDPE Line 1', 'HDPE Line 2'],
  provisional: true,
  unapprovedPeriods: 3,
  money: true,
  sections: [
    {
      kind: 'kpis',
      title: 'Operational OEE (ISO 22400)',
      items: [
        { label: 'OEE', value: '0.7812', type: 'percent' },
        {
          label: 'Availability',
          value: '0.9',
          type: 'percent',
          caption: 'over scheduled time',
        },
        { label: 'Performance', value: '0.92', type: 'percent' },
        { label: 'Quality', value: '0.9435', type: 'percent' },
        { label: 'Downtime', value: '12600', type: 'duration' },
        { label: 'Loss value', value: '182340.5', type: 'money', unit: 'USD' },
      ],
    },
    {
      kind: 'table',
      title: 'Production by product',
      note: 'Plan ledger target and actual; prime = good − wide spec.',
      columns: [
        { label: 'Product', type: 'text', width: 2.2 },
        { label: 'Plan', type: 'number', unit: 't' },
        { label: 'Actual', type: 'number', unit: 't' },
        { label: 'Attainment', type: 'percent' },
        { label: 'Prime', type: 'number', unit: 't' },
        { label: 'Off-grade', type: 'number', unit: 't' },
        { label: 'Prime yield', type: 'percent' },
      ],
      rows: Array.from({ length: 45 }, (_, i) => [
        `HD52${i} film grade`,
        '1000',
        String(850 + i),
        '0.85',
        '820',
        '12.5',
        '0.9612',
      ]),
    },
    {
      kind: 'table',
      title: 'Events',
      columns: [
        { label: 'Start', type: 'datetime' },
        { label: 'Day', type: 'date' },
        { label: 'Month', type: 'month' },
        { label: 'Reason', type: 'text', width: 2 },
        { label: 'Duration', type: 'duration' },
      ],
      rows: [
        [
          '2027-03-01T03:30:00.000Z',
          '2027-03-01',
          '2027-03',
          'FEED Feeder trip',
          '3600',
        ],
      ],
    },
  ],
};

class Sink {
  chunks: Buffer[] = [];
  write(chunk: Buffer): Promise<void> {
    this.chunks.push(chunk);
    return Promise.resolve();
  }
  get bytes() {
    return Buffer.concat(this.chunks);
  }
}

describe('report export renderers', () => {
  const generatedAt = new Date('2027-03-02T05:00:00Z');

  it('draws a PDF with the logo, the stamp and every table row', async () => {
    const sink = new Sink();
    const rows = await writeReportPdf(
      {
        document: SAMPLE,
        presentation,
        fonts: resolvePdfFonts({}),
        logo: reportLogo(),
        generatedAt,
      },
      sink,
    );
    expect(rows).toBe(46);
    expect(sink.bytes.subarray(0, 5).toString()).toBe('%PDF-');
    if (process.env.REPORT_RENDER_OUT)
      writeFileSync(
        join(process.env.REPORT_RENDER_OUT, 'sample.pdf'),
        sink.bytes,
      );
  });

  it('writes a workbook: a summary and one sheet per table', async () => {
    const sink = new Sink();
    const rows = await writeReportXlsx(
      { document: SAMPLE, presentation, logo: reportLogo(), generatedAt },
      sink,
    );
    expect(rows).toBe(46);
    expect(sink.bytes.subarray(0, 2).toString()).toBe('PK');
    if (process.env.REPORT_RENDER_OUT)
      writeFileSync(
        join(process.env.REPORT_RENDER_OUT, 'sample.xlsx'),
        sink.bytes,
      );
  });

  it('stores real values: ratios, days of a duration, dates on the plant clock', () => {
    expect(xlsxValue('0.85', { type: 'percent' }, null)).toBe(0.85);
    expect(xlsxValue('3600', { type: 'duration' }, null)).toBeCloseTo(
      1 / 24,
      10,
    );
    expect(
      xlsxValue(
        '2027-03-01T03:30:00.000Z',
        { type: 'datetime' },
        'Asia/Tehran',
      ),
    ).toEqual(new Date(Date.UTC(2027, 2, 1, 7, 0)));
    expect(numFmtOf({ type: 'number', places: 0 })).toBe('#,##0');
    expect(sheetName('Loss: by [reason]/unit?', new Set())).toBe(
      'Loss  by  reason  unit',
    );
  });
});
