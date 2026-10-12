import { ValidationPipe } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { ChangeV2Dto, FiveWhyV2Dto, FmeaV2Dto } from './rca-analyses-v2.dto';
import { RcaCaseV2UpdateDto } from './rca-cases-v2.dto';

const pipe: ValidationPipe = createValidationPipe();

async function accepts(
  metatype: new () => unknown,
  body: unknown,
): Promise<boolean> {
  try {
    await pipe.transform(body, { type: 'body', metatype });
    return true;
  } catch {
    return false;
  }
}

const evidence = {
  id: 'ev-1',
  title: 'Bearing photo',
  type: 'Photo',
  category: 'Mechanical',
  location: 'Pump house',
  occurredAt: '2026-10-01T08:00:00.000Z',
  severity: 'High',
  tags: ['bearing', 'p-101'],
  verified: true,
  fiveP: 'Parts',
  task: 'Collect the failed bearing',
  taskDueDate: '2026-10-05',
  taskStatus: 'pending',
  nodeIds: ['n1'],
  timeSeries: {
    provider: 'pi',
    streams: 'P101.VIB',
    mode: 'interpolated',
    start: '2026-10-01T00:00:00Z',
    end: '2026-10-02T00:00:00Z',
    intervals: 100,
  },
  attachments: [
    {
      fileName: '0b6dcb94-ca43-4a7b-867d-f5a356470c85.jpg',
      name: 'bearing.jpg',
      contentType: 'image/jpeg',
      size: 1200,
    },
  ],
};

describe('v2 RCA workspace contract (v1 parity of the case content and analysis tools)', () => {
  it('accepts the full evidence item, team charter and event diagram', async () => {
    const body = {
      teamCharter: 'Find why P-101 trips',
      evidence: [evidence],
      logicTree: [
        {
          id: 'n1',
          label: 'Pump trips',
          code: 'PT',
          description: 'seen 3 times',
          verified: true,
        },
      ],
      recommendations: [{ title: 'Realign', estimatedCost: '1250.50' }],
      eventDiagram: {
        nodes: [
          {
            id: 'e1',
            label: 'Alarm',
            type: 'Alarm',
            timestamp: '2026-10-01T07:55:00Z',
            severity: 'Medium',
            position: { x: 10, y: 20 },
          },
        ],
        edges: [],
      },
    };
    expect(await accepts(RcaCaseV2UpdateDto, body)).toBe(true);
  });

  it('refuses unknown evidence enums, foreign attachment names and inline data URLs', async () => {
    const stored = evidence.attachments[0].fileName;
    for (const bad of [
      { ...evidence, fiveP: 'Paperwork' },
      { ...evidence, taskStatus: 'done' },
      { ...evidence, attachments: [{ fileName: '../etc/passwd', name: 'x' }] },
      {
        ...evidence,
        attachments: [{ fileName: stored, name: 'x', dataUrl: 'data:,' }],
      },
    ]) {
      expect(await accepts(RcaCaseV2UpdateDto, { evidence: [bad] })).toBe(
        false,
      );
    }
  });

  it('validates the tool bodies (scores 1–10, known change categories, required problem)', async () => {
    const why = { level: 1, question: 'Why?', answer: 'Seal' };
    expect(
      await accepts(FiveWhyV2Dto, {
        problem: 'Trip',
        whyLevels: [why],
        rootCause: '',
      }),
    ).toBe(true);
    expect(
      await accepts(FiveWhyV2Dto, {
        problem: '',
        whyLevels: [],
        rootCause: '',
      }),
    ).toBe(false);
    const effect = {
      id: 'e1',
      description: 'Leak',
      severity: 8,
      currentControls: '',
      detection: 4,
    };
    const cause = { id: 'c1', description: 'Seal', occurrence: 3 };
    expect(
      await accepts(FmeaV2Dto, {
        failureMode: 'Seal leak',
        effects: [effect],
        causes: [cause],
      }),
    ).toBe(true);
    expect(
      await accepts(FmeaV2Dto, {
        failureMode: 'Seal leak',
        effects: [{ ...effect, severity: 11 }],
        causes: [],
      }),
    ).toBe(false);
    expect(
      await accepts(FmeaV2Dto, {
        failureMode: 'x',
        effects: [],
        causes: [{ ...cause, rpn: 1 }],
      }),
    ).toBe(false);
    const change = {
      id: 'ch1',
      category: 'Process',
      description: 'New SOP',
      changeDate: '2026-09-30',
      relatedToIncident: true,
      impactLevel: 'High',
    };
    expect(
      await accepts(ChangeV2Dto, {
        question: 'What changed?',
        changes: [change],
      }),
    ).toBe(true);
    expect(
      await accepts(ChangeV2Dto, {
        question: 'What changed?',
        changes: [{ ...change, category: 'Weather' }],
      }),
    ).toBe(false);
  });
});
