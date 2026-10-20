import { ExportJob } from '../entities/export-job.entity';
import { drawDocument } from '../pdf/pdf-draw';
import { PdfFonts } from '../pdf/pdf-fonts';
import { linesOf, PAGE_LINES } from '../pdf/pdf-layout';
import { ExportPresentation, PdfBlock } from '../pdf/pdf-model';
import { PdfSurface } from '../pdf/pdf-surface';
import { ExportPdfWriter } from '../pdf/export-pdf';
import { analysesSummary, RcaCaseExportContent } from './rca-case-content';
import { rcaCaseDocumentOf } from './rca-case-pdf';

const LATIN: PdfFonts = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  unicode: false,
};

const PLANT: ExportPresentation = {
  plantName: 'Marun HDPE',
  timezone: 'Asia/Tehran',
  calendar: 'gregorian',
  digits: 'latin',
  currency: 'USD',
};

const value = (currency: string, amount: string | null, status = 'valued') => ({
  currency,
  amount,
  valuedLines: 2,
  unvaluedLines: 0,
  provisionalLines: 0,
  status: status as 'valued' | 'mixed' | 'unvalued',
  fxProvisional: false,
});

function content(
  overrides: Partial<RcaCaseExportContent> = {},
): RcaCaseExportContent {
  return {
    case: {
      id: 'case-1',
      title: 'Repeated trips of extruder E-201',
      status: 'Closed',
      priority: 'High',
      unitName: 'HDPE line 1',
      description: 'Five trips in two weeks',
      consequenceClass: 'major',
      createdAt: '2026-09-01T05:00:00.000Z',
      createdByName: 'Reza',
      targetCloseDate: '2026-10-01T00:00:00.000Z',
      actualCloseDate: '2026-10-10T08:00:00.000Z',
      rootCause: 'Coupling misalignment',
    },
    team: { leadName: 'Sara', memberNames: ['Ali', 'Mina'] },
    timeline: [
      {
        at: '2026-09-01T05:00:00.000Z',
        action: 'rca_case.created',
        fromStatus: null,
        toStatus: 'In Progress',
        actorName: 'Reza',
        reason: null,
      },
      {
        at: '2026-10-10T08:00:00.000Z',
        action: 'rca_case.closed',
        fromStatus: 'Closure Review',
        toStatus: 'Closed',
        actorName: 'Sara',
        reason: 'verified',
      },
    ],
    causes: [
      {
        kind: 'contributing',
        code: null,
        name: null,
        statement: 'No alignment check after seal change',
      },
      {
        kind: 'root',
        code: 'MIS-01',
        name: 'Coupling misalignment',
        statement: 'Coupling misaligned',
      },
    ],
    analyses: analysesSummary({
      fiveWhy: null,
      fishbone: null,
      fmea: null,
      faultTree: null,
      barrier: null,
      change: null,
    }),
    actions: [
      {
        title: 'Realign coupling',
        ownerName: 'Ali',
        dueDate: '2026-09-20T00:00:00.000Z',
        status: 'done',
        completedAt: '2026-09-18T00:00:00.000Z',
        verificationStatus: 'evaluated',
        verdict: 'effective',
        selfDecided: true,
      },
    ],
    outcome: {
      approved: {
        lines: 3,
        basis: 'Approved plan lines of the latest approved revision',
        values: [value('IRR', '63000000'), value('USD', '1500.5', 'mixed')],
      },
      claimed: [
        { currency: 'IRR', amount: '42000000', actions: 1 },
        { currency: 'USD', amount: '1000', actions: 1 },
      ],
      realized: [
        {
          title: 'Realign coupling',
          metric: 'recurrences',
          expected: '4',
          observed: '1',
          difference: '3',
          verdict: 'effective',
        },
      ],
      note: 'separate figures, never added together',
    },
    closure: {
      residualRisk: 'Low',
      requestedByName: 'Sara',
      requestedAt: '2026-10-05T08:00:00.000Z',
      approvedByName: 'Sara',
      approvedAt: '2026-10-10T08:00:00.000Z',
      note: null,
      effectivenessVerdict: 'effective',
      selfDecided: true,
    },
    ...overrides,
  };
}

function job(overrides: Partial<ExportJob> = {}): ExportJob {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    reportType: 'rca_case',
    format: 'pdf',
    revisionSelector: 'case',
    filters: {
      from: null,
      to: null,
      unitIds: null,
      revisionIds: null,
      rcaId: 'case-1',
    },
    presentation: PLANT,
    caseContent: content(),
    labels: {
      requestedByName: 'Auditor',
      plantTimezone: 'Asia/Tehran',
      reasonCodes: {},
    },
    requestedBy: 'user-1',
    createdAt: new Date('2026-10-20T06:00:00.000Z'),
    ...overrides,
  } as ExportJob;
}

const blocks = (j: ExportJob, p = PLANT): PdfBlock[] =>
  rcaCaseDocumentOf(j, p).model.pages.flatMap((page) => page.blocks);
const facts = (j: ExportJob, p = PLANT) =>
  new Map(blocks(j, p).flatMap((b) => (b.kind === 'facts' ? b.rows : [])));
const headings = (j: ExportJob) =>
  blocks(j).flatMap((b) => (b.kind === 'heading' ? [b.text] : []));
const tableRows = (j: ExportJob) =>
  blocks(j).flatMap((b) => (b.kind === 'table' ? b.rows : []));

describe('RCA case PDF (item 2.5)', () => {
  it('prints every section of the case in order', () => {
    expect(headings(job())).toEqual([
      'Export',
      'Investigation',
      'Team',
      'Status timeline',
      'Causes by kind',
      'Analyses',
      'Actions',
      'Outcome (three separate figures)',
      'Closure approval',
    ]);
    const cover = facts(job());
    expect(cover.get('Report')).toBe('Investigation report');
    expect(cover.get('Money shown in')).toBe('USD');
    expect(cover.get('Requested')).toBe('2026-10-20 09:30');
  });

  it('timeline, causes root first, analyses and actions as rows', () => {
    const rows = tableRows(job());
    expect(rows).toContainEqual([
      '2026-09-01 08:30',
      'Opened (In Progress)',
      'Reza',
      '—',
    ]);
    expect(rows).toContainEqual([
      '2026-10-10 11:30',
      'Closure Review → Closed',
      'Sara',
      'verified',
    ]);
    const causes = rows.filter((r) => ['Root', 'Contributing'].includes(r[0]));
    expect(causes.map((r) => r[0])).toEqual(['Root', 'Contributing']);
    expect(causes[1][2]).toBe('Not coded');
    expect(rows).toContainEqual(['5-Why', 'Not recorded', '—', 'Not recorded']);
    expect(rows).toContainEqual([
      'Realign coupling',
      'Ali',
      '2026-09-20',
      'Done',
      '2026-09-18 · Self-decided (SuperAdmin)',
      'Evaluated',
      'Effective',
    ]);
    expect(rows).toContainEqual([
      'Realign coupling',
      'Recurrences',
      '4.00',
      '1.00',
      '3.00',
      'Effective',
    ]);
  });

  it('approved, claimed and realised stay separate; money in the display currency, never converted', () => {
    const usd = facts(job());
    expect(usd.get('Approved historical loss')).toBe(
      '1,500.50 USD (partly valued)',
    );
    expect(usd.get('Claimed avoided loss')).toBe(
      '1,000.00 USD; 42,000,000 IRR (not converted)',
    );
    const irrPlant = { ...PLANT, currency: 'IRR' as const };
    const irr = facts(job({ presentation: irrPlant }), irrPlant);
    expect(irr.get('Approved historical loss')).toBe('63,000,000 IRR');
    expect(irr.get('Claimed avoided loss')).toBe(
      '42,000,000 IRR; 1,000.00 USD (not converted)',
    );
    const none = content();
    none.outcome.approved.values = [];
    none.outcome.claimed = [];
    const empty = facts(job({ caseContent: none }));
    expect(empty.get('Approved historical loss')).toBe('Not reported in USD');
    expect(empty.get('Claimed avoided loss')).toBe('None claimed');
  });

  it('marks a SuperAdmin self-approved closure, and only then', () => {
    expect(facts(job()).get('Approval')).toBe('Self-approved (SuperAdmin)');
    const independent = content();
    independent.closure.selfDecided = false;
    expect(facts(job({ caseContent: independent })).has('Approval')).toBe(
      false,
    );
  });

  it('is the same document for the same job, every page within the line budget', () => {
    const first = rcaCaseDocumentOf(job(), PLANT);
    expect(rcaCaseDocumentOf(job(), PLANT)).toEqual(first);
    const many = content();
    many.actions = Array.from({ length: 60 }, (_, i) => ({
      ...many.actions[0],
      title: `Action ${i}`,
    }));
    const long = rcaCaseDocumentOf(job({ caseContent: many }), PLANT);
    expect(long.model.pages.length).toBeGreaterThan(1);
    for (const page of long.model.pages)
      expect(
        page.blocks.reduce((sum, b) => sum + linesOf(b), 0),
      ).toBeLessThanOrEqual(PAGE_LINES);
    expect(long.model.pages[0].header).toEqual({
      title: 'Investigation report · Marun HDPE',
      subtitle: 'Repeated trips of extruder E-201',
      status: 'CLOSED',
      tone: 'approved',
    });
  });

  it('refuses a job without pinned content', () => {
    expect(() => rcaCaseDocumentOf(job({ caseContent: null }), PLANT)).toThrow(
      'no pinned content',
    );
  });
});

class FakeSurface implements PdfSurface {
  readonly texts: string[] = [];
  addPage() {
    this.texts.push('<page>');
  }
  text(text: string) {
    this.texts.push(text);
  }
  rule() {
    /* lines are not asserted */
  }
  end() {
    return Promise.resolve();
  }
}

describe('RCA case PDF writer', () => {
  it('draws the same text for the same job and returns the printed rows', async () => {
    const draw = async () => {
      const writer = new ExportPdfWriter();
      const surface = new FakeSurface();
      writer.fonts = () => LATIN;
      writer.surfaces = () => Promise.resolve(surface);
      const rows = await writer.writeCase(job(), {
        write: () => Promise.resolve(),
      });
      return { rows, texts: surface.texts };
    };
    const first = await draw();
    expect(first.rows).toBe(tableRows(job()).length);
    expect(await draw()).toEqual(first);
    const { model } = rcaCaseDocumentOf(job(), PLANT);
    const replay = new FakeSurface();
    await drawDocument(model, replay);
    expect(replay.texts).toEqual(first.texts);
  });
});
