import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import {
  AccountingPolicy,
  PolicyKind,
} from '../../periods/entities/accounting-policy.entity';
import { parseOeePolicy } from '../../periods/engine-policy-bodies';
import { parseSourceAuthority } from '../../periods/policy-bodies';
import { STOP_EVENT_DEFAULTS } from '../../periods/stop-event-options';
import {
  atSliceBoundary,
  hierarchyOf,
  measuredEntries,
} from '../../domain/actuals/period/measurement-hierarchy';
import {
  check,
  coverageCheck,
  EffectiveSpan,
  overlapping,
} from './readiness-checks';
import { ReadinessStore } from './readiness-store';
import { EquipmentReadinessQueryDto } from './readiness-v2.dto';

export interface PolicySpan extends EffectiveSpan {
  policy: AccountingPolicy;
}
export interface PolicyFacts {
  stop: PolicySpan[];
  authority: PolicySpan[];
  valuation: PolicySpan[];
  checks: ReturnType<typeof check>[];
}
@Injectable()
export class ReadinessPoliciesService {
  constructor(private readonly store: ReadinessStore) {}
  async read(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
  ): Promise<PolicyFacts> {
    const rows = await this.store.rows(
      overlapping(
        this.store
          .query(AccountingPolicy, context)
          .andWhere(
            '(r.unitId = :unitId OR r.unitId IS NULL) AND r.policyKind IN (:...kinds)',
            {
              unitId: query.unitId,
              kinds: ['oee_policy', 'source_authority', 'valuation_basis'],
            },
          ),
        query,
      )
        .orderBy('r.unitId', 'ASC', 'NULLS LAST')
        .addOrderBy('r.version', 'DESC'),
    );
    const stop = policySpans(rows, 'oee_policy', query);
    const authority = policySpans(rows, 'source_authority', query);
    const valuation = policySpans(rows, 'valuation_basis', query);
    const checks = [
      this.stopCheck(stop, rows, query),
      this.authorityCheck(authority, rows, query),
      coverageCheck(
        'valuation_policy',
        valuation,
        query,
        rows.some((row) => row.policyKind === 'valuation_basis'),
      ),
    ];
    return { stop, authority, valuation, checks };
  }
  private stopCheck(
    spans: PolicySpan[],
    rows: AccountingPolicy[],
    query: EquipmentReadinessQueryDto,
  ) {
    const coverage = coverageCheck(
      'stop_policy',
      spans,
      query,
      rows.some((row) => row.policyKind === 'oee_policy'),
    );
    if (coverage.status !== 'ready') return coverage;
    const enabled = spans.every(
      ({ policy }) =>
        parseOeePolicy(policy.body).stopEvents?.deriveFromState ??
        STOP_EVENT_DEFAULTS.deriveFromState,
    );
    return check(
      'stop_policy',
      enabled ? 'ready' : 'needs_attention',
      enabled
        ? 'Effective stored stop policies cover the window and enable derivation from state.'
        : 'Stop derivation from state is disabled during part of this window.',
      1,
    );
  }
  private authorityCheck(
    spans: PolicySpan[],
    rows: AccountingPolicy[],
    query: EquipmentReadinessQueryDto,
  ) {
    const coverage = coverageCheck(
      'authority',
      spans,
      query,
      rows.some((row) => row.policyKind === 'source_authority'),
    );
    if (coverage.status !== 'ready') return coverage;
    const primaryMqtt = spans.every(({ policy }) => {
      const hierarchy = hierarchyOf(parseSourceAuthority(policy.body));
      return (
        measuredEntries(hierarchy).find((entry) =>
          atSliceBoundary(hierarchy, entry),
        )?.source === 'mqtt'
      );
    });
    return check(
      'authority',
      primaryMqtt ? 'ready' : 'needs_attention',
      primaryMqtt
        ? 'Approved MQTT primary output priority covers this window. Actual selection and conflicts still belong to the period calculation.'
        : 'MQTT is not the approved primary output source throughout this window. A conditional fallback does not guarantee it will be used.',
      1,
    );
  }
}
/** Highest effective unit version, then plant version; drafted kinds resolve approved versions only. No first-use seeding. */
export function policySpans(
  rows: AccountingPolicy[],
  kind: PolicyKind,
  query: EquipmentReadinessQueryDto,
): PolicySpan[] {
  const from = Date.parse(query.from),
    to = Date.parse(query.to);
  const candidates = rows.filter(
    (row) =>
      row.policyKind === kind &&
      !row.rejectedAt &&
      (kind === 'oee_policy' || row.approvedAt),
  );
  const cuts = [
    ...new Set([
      from,
      to,
      ...candidates
        .flatMap((row) => [
          row.effectiveFrom.getTime(),
          row.effectiveTo?.getTime() ?? to,
        ])
        .filter((at) => at > from && at < to),
    ]),
  ].sort((a, b) => a - b);
  return cuts.slice(0, -1).flatMap((at, index) => {
    const policy = candidates.find(
      (row) =>
        row.effectiveFrom.getTime() <= at &&
        (!row.effectiveTo || row.effectiveTo.getTime() > at),
    );
    return policy
      ? [
          {
            policy,
            effectiveFrom: new Date(at),
            effectiveTo: new Date(cuts[index + 1]),
          },
        ]
      : [];
  });
}
