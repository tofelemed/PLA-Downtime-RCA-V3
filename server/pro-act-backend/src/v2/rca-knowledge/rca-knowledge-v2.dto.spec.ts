import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import {
  RcaKnowledgeListQueryDto,
  RcaKnowledgeSimilarQueryDto,
  RcaKnowledgeVoteDto,
} from './rca-knowledge-v2.dto';

const pipe = createValidationPipe();

function parse<T>(
  metatype: new () => T,
  value: unknown,
  type: 'query' | 'body' = 'query',
): Promise<T> {
  return pipe.transform(value, { type, metatype }) as Promise<T>;
}

async function rejects(
  metatype: new () => unknown,
  value: unknown,
  type: 'query' | 'body' = 'query',
): Promise<boolean> {
  try {
    await parse(metatype, value, type);
    return false;
  } catch {
    return true;
  }
}

const UNIT = '8f14e45f-ceea-467a-a866-051cd2b7e0a1';

describe('v2 RCA knowledge DTOs', () => {
  it('parses the list filters from query strings (published "false" stays false)', async () => {
    const parsed = await parse(RcaKnowledgeListQueryDto, {
      q: 'coupling',
      unitId: UNIT,
      published: 'false',
      limit: '20',
      sort: 'createdAt',
    });
    expect(parsed).toMatchObject({
      q: 'coupling',
      unitId: UNIT,
      published: false,
      limit: 20,
      sort: 'createdAt',
    });
  });

  it('rejects an unknown sort, a non-uuid filter and undeclared fields', async () => {
    expect(await rejects(RcaKnowledgeListQueryDto, { sort: 'score' })).toBe(
      true,
    );
    expect(await rejects(RcaKnowledgeListQueryDto, { assetId: 'x' })).toBe(
      true,
    );
    expect(await rejects(RcaKnowledgeListQueryDto, { tenant: UNIT })).toBe(
      true,
    );
  });

  it('similar needs an event id and bounds the limit (default 5)', async () => {
    expect(await rejects(RcaKnowledgeSimilarQueryDto, {})).toBe(true);
    expect(
      await rejects(RcaKnowledgeSimilarQueryDto, {
        eventId: UNIT,
        limit: '21',
      }),
    ).toBe(true);
    const parsed = await parse(RcaKnowledgeSimilarQueryDto, { eventId: UNIT });
    expect(parsed.limit).toBe(5);
  });

  it('a vote is exactly { helpful: boolean }', async () => {
    expect(
      (await parse(RcaKnowledgeVoteDto, { helpful: false }, 'body')).helpful,
    ).toBe(false);
    expect(await rejects(RcaKnowledgeVoteDto, { helpful: 'yes' }, 'body')).toBe(
      true,
    );
    expect(
      await rejects(RcaKnowledgeVoteDto, { helpful: true, weight: 2 }, 'body'),
    ).toBe(true);
  });
});
