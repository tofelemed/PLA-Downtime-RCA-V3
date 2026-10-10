import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { CreateRcaDto } from '../../rca/dto/create-rca.dto';
import {
  parseRcaPolicy,
  RCA_POLICY_DEFAULT,
} from '../../domain/rca/rca-policy';
import { RcaActionV2CreateDto } from './rca-actions-v2.dto';
import { RcaCaseV2CreateDto, RcaCaseV2UpdateDto } from './rca-cases-v2.dto';
import { EventRcaLinkV2Dto } from './rca-links-v2.dto';

/** The body the v2 RCA screen sends (shared with the frontend contract test). */
const EXAMPLE = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../../contracts/rca/rca-case-v2.example.json'),
    'utf8',
  ),
) as Record<string, unknown>;

const pipe = createValidationPipe();

function parse<T>(
  metatype: new () => T,
  body: unknown,
  using: ValidationPipe = pipe,
): Promise<T> {
  return using.transform(body, { type: 'body', metatype }) as Promise<T>;
}

async function rejects(
  metatype: new () => unknown,
  body: unknown,
): Promise<boolean> {
  try {
    await parse(metatype, body);
    return false;
  } catch {
    return true;
  }
}

describe('v2 RCA case contract (plan 3.9 step 1, the v1 save bug)', () => {
  it('accepts the frontend body with nested recommendations, evidence and logic tree', async () => {
    const parsed = await parse(RcaCaseV2CreateDto, EXAMPLE);
    expect(parsed.recommendations?.[0].title).toBe('Replace the coupling');
    expect(parsed.logicTree).toHaveLength(2);
    expect(parsed.teamMemberIds).toHaveLength(2);
  });

  it('rejects the v1 builder fields that caused the 400 (tenant, organization, teamMembers text, legacy dates)', async () => {
    for (const extra of [
      { tenantId: EXAMPLE.unitId },
      { organizationId: EXAMPLE.unitId },
      { teamMembers: '[]' },
      { targetCompletionDate: '2026-11-30T00:00:00Z' },
      { additionalData: '{}' },
    ]) {
      expect(await rejects(RcaCaseV2CreateDto, { ...EXAMPLE, ...extra })).toBe(
        true,
      );
    }
  });

  it('rejects unknown fields inside nested items and invalid enums', async () => {
    const evidence = [{ title: 'x', fileBlob: 'abc' }];
    expect(await rejects(RcaCaseV2CreateDto, { ...EXAMPLE, evidence })).toBe(
      true,
    );
    expect(
      await rejects(RcaCaseV2CreateDto, { ...EXAMPLE, status: 'Done' }),
    ).toBe(true);
    expect(await rejects(RcaCaseV2CreateDto, { title: '' })).toBe(true);
  });

  it('update is partial; the event link takes rcaId or a nested create body', async () => {
    expect(await parse(RcaCaseV2UpdateDto, { status: 'Closed' })).toEqual({
      status: 'Closed',
    });
    const link = await parse(EventRcaLinkV2Dto, {
      create: { title: 'Trip' },
      reason: 'same symptom',
    });
    expect(link.create?.title).toBe('Trip');
    expect(
      await rejects(EventRcaLinkV2Dto, {
        create: { title: 'Trip', tenantId: 'x' },
      }),
    ).toBe(true);
  });

  it('actions: decimal claims as strings, baseline metric and window bounds', async () => {
    const action = await parse(RcaActionV2CreateDto, {
      title: 'Realign coupling',
      claimedAvoidedLoss: '1000.5',
      claimedCurrency: 'USD',
      baseline: { metric: 'recurrences', windowDays: 30 },
    });
    expect(action.baseline?.windowDays).toBe(30);
    expect(
      await rejects(RcaActionV2CreateDto, {
        title: 'x',
        claimedAvoidedLoss: 1000,
      }),
    ).toBe(true);
    expect(
      await rejects(RcaActionV2CreateDto, {
        title: 'x',
        claimedCurrency: 'EUR',
      }),
    ).toBe(true);
    expect(
      await rejects(RcaActionV2CreateDto, {
        title: 'x',
        baseline: { metric: 'cost', windowDays: 30 },
      }),
    ).toBe(true);
  });
});

describe('v1 RCA DTO (flag-off plants, plan 3.9)', () => {
  const v1Pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('accepts arrays for recommendations / evidence / logic tree and a case without event', async () => {
    const body = {
      title: 'T',
      status: 'Draft',
      priority: 'High',
      recommendations: [],
      evidence: [],
      logicTree: [],
    };
    const parsed = await parse(CreateRcaDto, body, v1Pipe);
    expect(parsed.recommendations).toEqual([]);
  });

  it('still accepts JSON text and rejects numbers', async () => {
    await expect(
      parse(
        CreateRcaDto,
        { title: 'T', status: 'Draft', priority: 'Low', evidence: '[]' },
        v1Pipe,
      ),
    ).resolves.toBeDefined();
    await expect(
      parse(
        CreateRcaDto,
        { title: 'T', status: 'Draft', priority: 'Low', evidence: 5 },
        v1Pipe,
      ),
    ).rejects.toBeDefined();
  });
});

describe('rca_policy body (D13)', () => {
  it('parses the default and refuses malformed bodies', () => {
    expect(parseRcaPolicy({ ...RCA_POLICY_DEFAULT })).toEqual(
      RCA_POLICY_DEFAULT,
    );
    expect(() =>
      parseRcaPolicy({ ...RCA_POLICY_DEFAULT, autoCreate: 'auto' }),
    ).toThrow();
    expect(() =>
      parseRcaPolicy({ ...RCA_POLICY_DEFAULT, repeatCount: 0 }),
    ).toThrow();
    expect(() =>
      parseRcaPolicy({ ...RCA_POLICY_DEFAULT, costThreshold: -1 }),
    ).toThrow();
  });

  it('matches contracts/policies/defaults/rca_policy.default.json', () => {
    const file = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../../../../contracts/policies/defaults/rca_policy.default.json',
        ),
        'utf8',
      ),
    ) as { body: unknown };
    expect(parseRcaPolicy(file.body)).toEqual(RCA_POLICY_DEFAULT);
  });
});
