import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import {
  RcaActionV2ListQueryDto,
  RcaActionV2UpdateDto,
} from './rca-actions-v2.dto';
import { RcaCaseV2ListQueryDto, RcaCaseV2UpdateDto } from './rca-cases-v2.dto';
import { RcaOccurrenceV2ListQueryDto } from './rca-links-v2.dto';

const pipe = createValidationPipe();
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function parse<T>(
  metatype: new () => T,
  value: unknown,
  type: 'body' | 'query' = 'body',
): Promise<T> {
  return pipe.transform(value, { type, metatype }) as Promise<T>;
}

async function rejects(
  metatype: new () => unknown,
  value: unknown,
  type: 'body' | 'query' = 'body',
): Promise<boolean> {
  try {
    await parse(metatype, value, type);
    return false;
  } catch {
    return true;
  }
}

describe('U3 additive RCA contract', () => {
  it('parses the cross-case action list query (repeated status, boolean strings)', async () => {
    const parsed = await parse(
      RcaActionV2ListQueryDto,
      { mine: 'true', overdue: 'false', status: ['open', 'in_progress'] },
      'query',
    );
    expect(parsed).toMatchObject({
      mine: true,
      overdue: false,
      status: ['open', 'in_progress'],
      limit: 100,
    });
    const single = await parse(
      RcaActionV2ListQueryDto,
      { status: 'done' },
      'query',
    );
    expect(single.status).toEqual(['done']);
    expect(
      await rejects(RcaActionV2ListQueryDto, { status: 'closed' }, 'query'),
    ).toBe(true);
    expect(
      await rejects(RcaActionV2ListQueryDto, { sort: '-createdAt' }, 'query'),
    ).toBe(true);
    expect(
      await rejects(RcaActionV2ListQueryDto, { owner: 'me' }, 'query'),
    ).toBe(true);
  });

  it('accepts an optional cancellation reason on an action', async () => {
    const parsed = await parse(RcaActionV2UpdateDto, {
      status: 'cancelled',
      cancelReason: 'Superseded by the redesign',
    });
    expect(parsed.cancelReason).toBe('Superseded by the redesign');
    expect(
      (await parse(RcaActionV2UpdateDto, { status: 'cancelled' })).cancelReason,
    ).toBeUndefined();
    expect(
      await rejects(RcaActionV2UpdateDto, { cancelReason: 'x'.repeat(2001) }),
    ).toBe(true);
  });

  it('accepts the open filter on the case list', async () => {
    const parsed = await parse(
      RcaCaseV2ListQueryDto,
      { open: 'true', priority: 'Critical' },
      'query',
    );
    expect(parsed).toMatchObject({ open: true, priority: 'Critical' });
  });

  it('accepts an evidence task assignee and a read item sent back with its verifier', async () => {
    const parsed = await parse(RcaCaseV2UpdateDto, {
      evidence: [
        {
          id: 'ev-1',
          title: 'Bearing photo',
          taskAssigneeId: userId,
          verified: true,
          verifiedBy: userId,
          verifiedAt: '2026-10-18T08:00:00.000Z',
        },
      ],
    });
    expect(parsed.evidence?.[0].taskAssigneeId).toBe(userId);
    expect(
      await rejects(RcaCaseV2UpdateDto, {
        evidence: [{ title: 'x', taskAssigneeId: 'someone' }],
      }),
    ).toBe(true);
  });

  it('parses the occurrence picker query', async () => {
    const parsed = await parse(
      RcaOccurrenceV2ListQueryDto,
      {
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-18T00:00:00Z',
        q: 'jam',
        limit: '20',
      },
      'query',
    );
    expect(parsed).toMatchObject({ q: 'jam', limit: 20 });
    expect(
      await rejects(RcaOccurrenceV2ListQueryDto, { eventId: 'x' }, 'query'),
    ).toBe(true);
  });
});
