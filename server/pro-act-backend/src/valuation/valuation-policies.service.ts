import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import {
  parseValuationPolicy,
  ValuationPolicyBody,
  ValuationPolicyError,
} from '../domain/valuation/valuation-policy';
import { AccountingPolicy } from '../periods/entities/accounting-policy.entity';
import {
  invalid,
  invalidReference,
  invalidTransition,
  notFound,
} from '../profiles/profile-errors';
import { assertTenantWideWriter } from '../profiles/profile-scope';
import { keysetPage } from '../v2/common/keyset-page';
import {
  recordValuationChanges,
  RevaluationRequested,
} from './valuation-events';
import { ensureValuationPolicy, snapshotOf } from './valuation-policy.store';

type V3Fields = Pick<
  ValuationPolicyBody,
  | 'fxRateType'
  | 'fxDateRule'
  | 'fxAverageMaxDeviation'
  | 'demandRule'
  | 'qualityDispositions'
  | 'defaultQualityDisposition'
  | 'manualLineHours'
>;

export interface NewValuationPolicy extends V3Fields {
  defaultBasis: ValuationPolicyBody['defaultBasis'];
  timeBasisRule: 'exclusive' | 'independent_components';
  reportingCurrencies: string[];
  fxPolicy: 'none' | 'snapshot';
  independentImpactCodeIds?: string[];
  effectiveFrom: string;
  notes?: string | null;
}

const V3_KEYS: ReadonlyArray<keyof V3Fields> = [
  'fxRateType',
  'fxDateRule',
  'fxAverageMaxDeviation',
  'demandRule',
  'qualityDispositions',
  'defaultQualityDisposition',
  'manualLineHours',
];

const KIND = 'valuation_basis';
const WHAT = 'valuation policy';

/**
 * `valuation_basis` policy versions (plan 2.6, VAL01, D08): tenant-wide settings, so every write needs a
 * tenant-wide grant (403 `TENANT_SCOPE_REQUIRED`). A change is a new unapproved version (old versions are
 * never rewritten, runs keep the version they used); approval records the finance sign-off and must come
 * from someone other than the author (policy contract, 403 `SEPARATION_OF_DUTIES`). Valuation applies the
 * highest approved version in force; approving does not recalculate periods by itself (next recompute).
 */
@Injectable()
export class ValuationPoliciesService {
  constructor(
    @InjectRepository(AccountingPolicy)
    private readonly policies: Repository<AccountingPolicy>,
  ) {}

  async list(
    context: RequestContext,
    page: { cursor?: string; limit: number },
  ): Promise<{ items: AccountingPolicy[]; nextCursor: string | null }> {
    await ensureValuationPolicy(
      this.policies.manager,
      requireTenantId(context),
    );
    const qb = scopedQuery(this.policies, 'p', { context }).andWhere(
      'p.policyKind = :kind',
      { kind: KIND },
    );
    return keysetPage(qb, {
      alias: 'p',
      property: 'createdAt',
      direction: 'DESC',
      cursor: page.cursor,
      limit: page.limit,
    });
  }

  async get(context: RequestContext, id: string): Promise<AccountingPolicy> {
    const found = await scopedQuery(this.policies, 'p', { context })
      .andWhere('p.id = :id AND p.policyKind = :kind', { id, kind: KIND })
      .getOne();
    if (!found) throw notFound('Valuation policy');
    return found;
  }

  async create(
    context: RequestContext,
    input: NewValuationPolicy,
  ): Promise<AccountingPolicy> {
    const tenantId = requireTenantId(context);
    assertTenantWideWriter(context, tenantId);
    await this.assertImpactCodes(tenantId, [
      ...(input.independentImpactCodeIds ?? []),
      ...Object.keys(input.qualityDispositions ?? {}),
    ]);
    const body = bodyOf(input);
    const effectiveFrom = new Date(input.effectiveFrom);
    return this.policies.manager.transaction(async (manager) => {
      await ensureValuationPolicy(manager, tenantId);
      const next = await nextPolicyVersion(manager, tenantId);
      return manager.save(
        manager.create(AccountingPolicy, {
          tenantId,
          policyKind: KIND,
          unitId: null,
          scopeKey: 'tenant',
          version: next,
          body: { ...body },
          effectiveFrom,
          effectiveTo: null,
          approvedBy: null,
          approvedAt: null,
          notes: input.notes?.trim() || null,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  /** Records the finance sign-off; SME V7: the periods it values are queued for revaluation with it. */
  async approve(
    context: RequestContext,
    id: string,
  ): Promise<{
    policy: AccountingPolicy;
    revaluation: RevaluationRequested | null;
  }> {
    const policy = await this.get(context, id);
    assertApprovable(context, policy);
    const revaluation = await this.policies.manager.transaction(
      async (manager) => {
        const updated = await manager
          .createQueryBuilder()
          .update(AccountingPolicy)
          .set({
            approvedAt: () => 'now()',
            approvedBy: context.userId,
            updatedBy: context.userId,
          })
          .where('id = :id AND approved_at IS NULL', { id: policy.id })
          .execute();
        if (!updated.affected)
          throw invalidTransition(WHAT, 'approved', 'approved');
        return recordValuationChanges(manager, [
          {
            tenantId: policy.tenantId,
            subject: 'valuation_policy',
            change: 'approved',
            row: policy,
          },
        ]);
      },
    );
    return { policy: await this.get(context, id), revaluation };
  }

  /** Independent-component impact codes must be impact codes of the tenant (422 INVALID_REFERENCE). */
  private async assertImpactCodes(
    tenantId: string,
    ids: readonly string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    const unique = [...new Set(ids)];
    const rows = await this.policies.manager.query<unknown[]>(
      `SELECT 1 FROM "impact_codes" WHERE "id" = ANY($1::uuid[]) AND "tenant_id"::text = $2`,
      [unique, tenantId],
    );
    if (rows.length !== unique.length) {
      throw invalidReference(
        'independentImpactCodeIds / qualityDispositions',
        'impact code',
      );
    }
  }
}

/** The stored body of a new version, checked by the same parser valuation uses (422 `INVALID_POLICY`). */
function bodyOf(input: NewValuationPolicy): ValuationPolicyBody {
  const body: ValuationPolicyBody = {
    defaultBasis: input.defaultBasis,
    timeBasisRule: input.timeBasisRule,
    reportingCurrencies: [...new Set(input.reportingCurrencies)],
    fxPolicy: input.fxPolicy,
    independentImpactCodeIds: [
      ...new Set(input.independentImpactCodeIds ?? []),
    ],
    ...v3FieldsOf(input),
  };
  try {
    parseValuationPolicy(body, { id: null, version: null, approved: false });
  } catch (error: unknown) {
    if (error instanceof ValuationPolicyError)
      throw invalid('INVALID_POLICY', error.message);
    throw error;
  }
  return body;
}

/** Tenant-wide grant, not yet approved, not the author, a decided currency (403 / 409 / 422). */
function assertApprovable(
  context: RequestContext,
  policy: AccountingPolicy,
): void {
  assertTenantWideWriter(context, policy.tenantId);
  if (policy.approvedAt) throw invalidTransition(WHAT, 'approved', 'approved');
  if (policy.createdBy && policy.createdBy === context.userId) {
    throw new ForbiddenException({
      code: 'SEPARATION_OF_DUTIES',
      message:
        'a valuation policy version is approved by someone other than its author',
    });
  }
  if (snapshotOf(policy).currencies.length === 0) {
    throw invalid(
      'CURRENCY_UNDECIDED',
      'a version without a reporting currency (XXX) cannot be approved',
    );
  }
}

/** The v3 fields the author sent (an older-style body stays exactly as before). */
function v3FieldsOf(input: NewValuationPolicy): V3Fields {
  const fields: Record<string, unknown> = {};
  for (const key of V3_KEYS) {
    if (input[key] !== undefined) fields[key] = input[key];
  }
  return fields;
}

/** Next tenant-wide version number of the kind, under a per-tenant advisory lock. */
async function nextPolicyVersion(
  manager: EntityManager,
  tenantId: string,
): Promise<number> {
  await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `accounting_policies:${tenantId}:${KIND}`,
  ]);
  const [{ next }] = await manager.query<Array<{ next: number }>>(
    `SELECT coalesce(max("version"), 0) + 1 AS "next" FROM "accounting_policies"
      WHERE "tenant_id" = $1 AND "policy_kind" = $2 AND "scope_key" = 'tenant'`,
    [tenantId, KIND],
  );
  return next;
}
