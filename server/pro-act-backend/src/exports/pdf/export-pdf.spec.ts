import { ExportJob } from '../entities/export-job.entity';
import { RenderSource, reviewedOf } from '../export-report';
import { ExportPdfWriter, pdfDocumentOf } from './export-pdf';
import { drawDocument } from './pdf-draw';
import { latinOnly, PdfFonts, resolvePdfFonts } from './pdf-fonts';
import { PAGE_LINES, linesOf } from './pdf-layout';
import { ExportPresentation, PdfBlock } from './pdf-model';
import { PdfInfo, PdfSink, PdfSurface, PdfTextStyle } from './pdf-surface';

const SLICE = '11111111-1111-4111-8111-111111111111';
const LATIN: PdfFonts = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  unicode: false,
};
const PERSIAN_FONT: PdfFonts = {
  regular: '/fonts/v.ttf',
  bold: '/fonts/v.ttf',
  unicode: true,
};

const PLANT: ExportPresentation = {
  plantName: 'Bandar Imam',
  timezone: 'Asia/Tehran',
  calendar: 'gregorian',
  digits: 'latin',
  currency: 'USD',
};

/** An accepted availability candidate caused by a stop, with or without a reason code. */
const candidate = (reasonCodeId: string | null, quantity: string) => ({
  lossLineId: `cand-${quantity}`,
  autoKey: quantity,
  sliceId: SLICE,
  kind: 'availability',
  quantity,
  basis: 'planning_rate',
  reasonCodeId,
  impactCodeId: null,
  causeEventId: 'event-1',
  state: 'accepted',
  effectiveQuantity: quantity,
});

function job(overrides: Partial<ExportJob> = {}): ExportJob {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    reportType: 'period_summary',
    format: 'pdf',
    revisionSelector: 'published',
    filters: {
      from: '2026-10-11T20:30:00.000Z',
      to: '2026-10-12T20:30:00.000Z',
      unitIds: null,
      revisionIds: null,
    },
    presentation: PLANT,
    requestedBy: 'user-1',
    createdAt: new Date('2026-10-13T06:00:00.000Z'),
    counts: {
      accepted: 1,
      processed: 0,
      quarantined: 0,
      rejected: 0,
      pending: 1,
    },
    ...overrides,
  } as ExportJob;
}

function source(
  options: { provisional?: boolean; lines?: number } = {},
): RenderSource {
  const lines = Array.from({ length: options.lines ?? 0 }, (_, i) => ({
    id: `manual-${i}`,
    action: 'manual',
    autoKey: null,
    sliceId: SLICE,
    kind: 'availability',
    quantity: '1.005',
    uom: 't',
    basis: 'planning_rate',
    reasonCodeId: null,
    impactCodeId: null,
    reason: 'pump trip',
  }));
  return {
    periodId: 'period-1',
    unitId: 'unit-1',
    unitName: 'Reactor 1',
    revisionId: 'revision-1',
    revision: 2,
    snapshotId: 'snapshot-1',
    approvedAt: '2026-10-12T21:00:00.000Z',
    sliceProducts: { [SLICE]: { productId: 'p-1', productName: 'HDPE' } },
    selfApproved: false,
    reviewed: reviewedOf({
      reviewed: {
        utcStart: '2026-10-12T02:30:00.000Z',
        utcEnd: '2026-10-12T10:30:00.000Z',
        run: { id: 'run-1' },
        actuals: [{ sliceId: SLICE, qualityState: 'good', coverageRatio: '1' }],
        slices: [
          {
            sliceId: SLICE,
            uom: 't',
            target: '1000',
            actual: '850.125',
            gap: '149.875',
            attributed: '149.875',
            toleranceAdjustment: '0',
            residual: '0',
            overAccounted: null,
            overproduction: null,
            flags: [],
          },
        ],
        candidates: [],
        lines,
        valuation: {
          engineVersion: '1',
          policyId: 'pol',
          policyVersion: 1,
          approved: true,
          defaultView: 'contribution_margin',
          currencies: ['USD', 'IRR'],
          timeBasisRule: 'r',
          fxPolicy: 'f',
          lines: [],
          slices: ['USD', 'IRR'].map((currency) => ({
            sliceId: SLICE,
            view: 'contribution_margin',
            currency,
            amount: currency === 'USD' ? '1234.5' : '51234567.5',
            nativeAmount: '1',
            status: 'valued',
            reasons: [],
            unvaluedQuantity: '0',
            unvaluedSeconds: '0',
            valuedLines: 1,
            unvaluedLines: 0,
            fxMissingLines: 0,
            fxProvisionalLines:
              options.provisional && currency === 'USD' ? 1 : 0,
            fxRateIds: [],
          })),
        },
      },
    }),
  };
}

const allText = (blocks: PdfBlock[]) =>
  blocks.flatMap((b) => {
    if (b.kind === 'facts') return b.rows.flatMap(([k, v]) => [k, v]);
    if (b.kind === 'table')
      return [...b.columns.map((c) => c.label), ...b.rows.flat()];
    return [b.text];
  });

describe('PDF export layout', () => {
  it('prints the cover, the approved section and its table on the plant clock in USD by default', () => {
    const { model, rowCount } = pdfDocumentOf(job(), [source()], LATIN);
    expect(model.pages).toHaveLength(1);
    const [page] = model.pages;
    expect(page.header).toEqual({
      title: 'Period summary · Bandar Imam',
      subtitle:
        '2026-10-12 00:00 – 2026-10-13 00:00 · Loss values: Contribution margin',
      status: 'APPROVED',
      tone: 'approved',
    });
    const text = allText(page.blocks);
    expect(text).toEqual(
      expect.arrayContaining([
        'Approved revisions only',
        'Asia/Tehran',
        'USD',
        'Approved',
      ]),
    );
    expect(text).toContain('Reactor 1 · 2026-10-12 06:00–14:00');
    expect(text).toContain('2026-10-13 00:30');
    expect(text).toEqual(
      expect.arrayContaining(['HDPE', '1,000.00', '850.13', '1,234.50 USD']),
    );
    expect(page.footer).toMatch(/^Page 1 of 1 · Export aaaaaaaa/);
    expect(rowCount).toBe(1);
    expect(model.info.createdAt.toISOString()).toBe('2026-10-13T06:00:00.000Z');
  });

  it('prints money in IRR when asked, without a minor unit', () => {
    const { model } = pdfDocumentOf(
      job({ presentation: { ...PLANT, currency: 'IRR' } }),
      [source()],
      LATIN,
    );
    expect(allText(model.pages[0].blocks)).toContain('51,234,568 IRR');
  });

  it('labels values with a provisional FX rate on the section and every page header', () => {
    const { model } = pdfDocumentOf(
      job(),
      [source({ provisional: true })],
      LATIN,
    );
    const [page] = model.pages;
    expect(page.header.status).toBe('APPROVED · PROVISIONAL FX');
    expect(page.header.tone).toBe('provisional');
    const text = allText(page.blocks);
    expect(text).toContain(
      'Approved · values marked * use a provisional FX rate',
    );
    expect(text).toContain('1,234.50 USD *');
    expect(text).toContain('f; values marked * use a provisional FX rate');
  });

  it('Marun E2E: names the valuation basis and the exchange-rate source of the loss values', () => {
    const { model } = pdfDocumentOf(job(), [source()], LATIN);
    const blocks = model.pages[0].blocks;
    const facts = blocks.flatMap((b) => (b.kind === 'facts' ? b.rows : []));
    expect(facts).toEqual(
      expect.arrayContaining([
        ['Loss value basis', 'Contribution margin'],
        [
          'Loss value basis',
          'Contribution margin (valuation policy version 1)',
        ],
        ['Exchange rates', 'f'],
      ]),
    );
    const snapshot = source();
    const valuation = snapshot.reviewed.valuation;
    if (!valuation) throw new Error('fixture has a valuation');
    valuation.fxPolicy = 'snapshot';
    const economic = source();
    if (economic.reviewed.valuation)
      economic.reviewed.valuation.defaultView = 'economic_impact';
    const mixed = pdfDocumentOf(job(), [snapshot, economic], LATIN).model;
    expect(mixed.pages[0].header.subtitle).toContain(
      'Loss values: several bases (see each revision)',
    );
    expect(allText(mixed.pages[0].blocks)).toContain(
      'rates frozen in the approval snapshot',
    );
  });

  it('Marun G3: a named-revision export prints its selection, not a window; a line basis reads in words', () => {
    const named = job({
      reportType: 'loss_lines',
      filters: {
        from: null,
        to: null,
        unitIds: null,
        revisionIds: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
      },
    } as unknown as Partial<ExportJob>);
    const blocks = pdfDocumentOf(named, [source({ lines: 1 })], LATIN).model
      .pages[0].blocks;
    const facts = blocks.flatMap((b) => (b.kind === 'facts' ? b.rows : []));
    expect(facts).toContainEqual(['Selection', '1 named approved revision']);
    expect(facts.map(([label]) => label)).not.toContain('Window (plant time)');
    const text = allText(blocks);
    expect(text).toContain('Planning rate');
    expect(text).not.toContain('planning_rate');
  });

  it('uses the Persian calendar, and Persian digits only when the font has them', () => {
    const persian = job({
      presentation: { ...PLANT, calendar: 'persian', digits: 'persian' },
    });
    const latin = allText(
      pdfDocumentOf(persian, [source()], LATIN).model.pages[0].blocks,
    );
    expect(latin).toContain('Reactor 1 · 1405/07/20 06:00–14:00');
    const shaped = pdfDocumentOf(persian, [source()], PERSIAN_FONT).model;
    expect(allText(shaped.pages[0].blocks)).toContain(
      'Reactor 1 · ۱۴۰۵/۰۷/۲۰ ۰۶:۰۰–۱۴:۰۰',
    );
    expect(allText(shaped.pages[0].blocks)).toContain('۱٬۲۳۴٫۵۰ USD');
    expect(shaped.pages[0].footer).toMatch(/^Page ۱ of ۱/);
  });

  it('continues a long table on further pages under its heading, every page within the line budget', () => {
    const { model, rowCount } = pdfDocumentOf(
      job({ reportType: 'loss_lines' }),
      [source({ lines: 80 })],
      LATIN,
    );
    expect(rowCount).toBe(80);
    expect(model.pages.length).toBeGreaterThan(2);
    for (const page of model.pages) {
      expect(
        page.blocks.reduce((sum, b) => sum + linesOf(b), 0),
      ).toBeLessThanOrEqual(PAGE_LINES);
      expect(page.footer).toContain(`of ${model.pages.length}`);
    }
    expect(model.pages[1].blocks[0]).toEqual({
      kind: 'heading',
      text: 'Reactor 1 · 2026-10-12 06:00–14:00 (continued)',
    });
    const printed = model.pages
      .flatMap((p) => p.blocks)
      .filter((b) => b.kind === 'table')
      .reduce((n, b) => n + (b.kind === 'table' ? b.rows.length : 0), 0);
    expect(printed).toBe(80);
  });

  it('loss lines: labelled source, kind and state, and a reason column with the pinned code or the comment', () => {
    const coded = source({ lines: 1 });
    coded.reviewed.candidates.push(candidate('rc-1', '28'));
    const { model } = pdfDocumentOf(
      job({
        reportType: 'loss_lines',
        labels: {
          requestedByName: 'Sara',
          plantTimezone: 'Asia/Tehran',
          reasonCodes: {
            'rc-1': { code: 'MECH-GEARBOX', name: 'Gearbox failure' },
          },
        },
      }),
      [coded],
      LATIN,
    );
    const table = model.pages[0].blocks.find((b) => b.kind === 'table');
    expect(table?.kind === 'table' && table.columns.at(-1)?.label).toBe(
      'Reason',
    );
    const rows = table?.kind === 'table' ? table.rows : [];
    expect(rows[0].slice(1, 4)).toEqual([
      'Calculated',
      'Availability',
      'Accepted',
    ]);
    expect(rows[0].at(-1)).toBe('MECH-GEARBOX · Gearbox failure');
    expect(rows[1].slice(1, 4)).toEqual(['Manual', 'Availability', 'In force']);
    expect(rows[1].at(-1)).toBe('pump trip');
    expect(allText(model.pages[0].blocks)).toEqual(
      expect.arrayContaining(['Requested by', 'Sara']),
    );
  });

  it('QA re-test N9: an uncoded stop-caused line prints "Not coded" in the Reason column', () => {
    const uncoded = source();
    uncoded.reviewed.candidates.push(candidate(null, '14'));
    const { model } = pdfDocumentOf(
      job({ reportType: 'loss_lines' }),
      [uncoded],
      LATIN,
    );
    const table = model.pages[0].blocks.find((b) => b.kind === 'table');
    const rows = table?.kind === 'table' ? table.rows : [];
    expect(rows[0].at(-1)).toBe('Not coded');
  });

  it('says so when the window has no approved revisions', () => {
    const { model } = pdfDocumentOf(
      job({
        counts: {
          accepted: 0,
          processed: 0,
          quarantined: 0,
          rejected: 0,
          pending: 0,
        },
      }),
      [],
      LATIN,
    );
    expect(allText(model.pages[0].blocks)).toContain(
      'No approved revisions in this window.',
    );
  });

  it('refuses a PDF job without a pinned presentation', () => {
    expect(() => pdfDocumentOf(job({ presentation: null }), [], LATIN)).toThrow(
      'presentation',
    );
  });
});

class FakeSurface implements PdfSurface {
  pages = 0;
  readonly texts: Array<{
    text: string;
    y: number;
    style: PdfTextStyle;
    page: number;
  }> = [];
  ended = false;
  addPage() {
    this.pages += 1;
  }
  text(text: string, _x: number, y: number, style: PdfTextStyle) {
    this.texts.push({ text, y, style, page: this.pages });
  }
  rule() {
    /* lines are not asserted */
  }
  end() {
    this.ended = true;
    return Promise.resolve();
  }
}

describe('PDF drawing', () => {
  it('draws every page with its header, status colour and footer inside the page', async () => {
    const sources = Array.from({ length: 6 }, () =>
      source({ provisional: true }),
    );
    const { model } = pdfDocumentOf(job(), sources, LATIN);
    expect(model.pages.length).toBeGreaterThan(1);
    const surface = new FakeSurface();
    await drawDocument(model, surface);
    expect(surface.pages).toBe(model.pages.length);
    expect(surface.ended).toBe(true);
    const status = surface.texts.filter(
      (t) => t.text === 'APPROVED · PROVISIONAL FX',
    );
    expect(status).toHaveLength(model.pages.length);
    expect(status[0].style.color).toBe('#92400e');
    expect(Math.max(...surface.texts.map((t) => t.y))).toBeLessThan(595 - 20);
  });

  it('QA re-test N4: a long reason wraps inside its row and the next row starts below it', async () => {
    const long = source({ lines: 2 });
    long.reviewed.lines[0].reason =
      'MECH-GEARBOX · Gearbox failure — bearing seized on the main drive after the restart';
    long.reviewed.lines[1].reason = 'SPEED-LOSS · Reduced extrusion rate';
    const { model } = pdfDocumentOf(
      job({ reportType: 'loss_lines' }),
      [long],
      LATIN,
    );
    const surface = new FakeSurface();
    await drawDocument(model, surface);
    const firstLine = surface.texts.find((t) => t.text.startsWith('MECH'));
    const second = surface.texts.find((t) => t.text.startsWith('SPEED'));
    const firstRowLines = surface.texts.filter(
      (t) => t.y >= (firstLine?.y ?? 0) && t.y < (second?.y ?? 0),
    );
    expect(firstLine && second).toBeTruthy();
    const reasonLines = firstRowLines.filter(
      (t) => t.style.width === firstLine?.style.width,
    );
    expect(reasonLines.length).toBeGreaterThan(1);
    const lastOfFirst = Math.max(...reasonLines.map((t) => t.y));
    expect(second?.y ?? 0).toBeGreaterThan(lastOfFirst);
    for (const page of model.pages) {
      expect(
        page.blocks.reduce((sum, b) => sum + linesOf(b), 0),
      ).toBeLessThanOrEqual(PAGE_LINES);
    }
  });

  it('the writer hands the info to the surface factory and returns the printed rows', async () => {
    const writer = new ExportPdfWriter();
    const surface = new FakeSurface();
    let received: PdfInfo | null = null;
    writer.fonts = () => LATIN;
    writer.surfaces = (_sink: PdfSink, info: PdfInfo) => {
      received = info;
      return Promise.resolve(surface);
    };
    const rows = await writer.write(job(), [source()], {
      write: () => Promise.resolve(),
    });
    expect(rows).toBe(1);
    expect(received).toEqual({
      title: 'Period summary · Bandar Imam',
      subject:
        '2026-10-12 00:00 – 2026-10-13 00:00 · Loss values: Contribution margin',
      createdAt: new Date('2026-10-13T06:00:00.000Z'),
    });
  });
});

describe('PDF fonts', () => {
  it('uses Helvetica unless a Persian-capable font is configured', () => {
    expect(resolvePdfFonts({})).toEqual(LATIN);
    expect(
      resolvePdfFonts({
        EXPORT_PDF_FONT: '/f/r.ttf',
        EXPORT_PDF_FONT_BOLD: '/f/b.ttf',
      }),
    ).toEqual({ regular: '/f/r.ttf', bold: '/f/b.ttf', unicode: true });
  });

  it('replaces what Helvetica cannot draw', () => {
    expect(latinOnly('Reactor – 1 · ok')).toBe('Reactor – 1 · ok');
    expect(latinOnly('واحد 1')).toBe('???? 1');
  });
});
