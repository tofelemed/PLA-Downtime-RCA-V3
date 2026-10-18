import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { Dec } from '../../domain/actuals/decimal';
import { convert } from '../../domain/valuation/fx';
import { parseValuationPolicy } from '../../domain/valuation/valuation-policy';
import { FxRateSnapshot } from '../../domain/valuation/valuation.types';
import { ValuationRate } from '../../profiles/entities/valuation-rate.entity';
import { FxRate } from '../../valuation/entities/fx-rate.entity';
import { check, coverageCheck, overlapping } from './readiness-checks';
import { PolicyFacts } from './readiness-policies.service';
import { intersection, ProfileFacts } from './readiness-profiles.service';
import { ReadinessStore } from './readiness-store';
import { EquipmentReadinessQueryDto } from './readiness-v2.dto';

@Injectable()
export class ReadinessFinanceService {
  constructor(private readonly store: ReadinessStore) {}
  async read(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
    facts: { profiles: ProfileFacts; policies: PolicyFacts },
  ) {
    const profiles = facts.profiles.profiles;
    if (!profiles.length)
      return ['margin', 'fx'].map((id) =>
        check(
          id,
          'not_checked',
          'Choose a product and approve its effective profile before checking margin and FX.',
        ),
      );
    const rates = await this.store.rows(
      overlapping(
        this.store
          .query(ValuationRate, context)
          .andWhere('r.profileId IN (:...ids) AND r.basis = :basis', {
            ids: profiles.map((row) => row.id),
            basis: 'contribution_margin',
          }),
        query,
      ),
    );
    const approved = rates
      .filter(
        (rate) =>
          rate.state === 'approved' &&
          rate.currency &&
          rate.perUom ===
            profiles.find((profile) => profile.id === rate.profileId)
              ?.quantityUom,
      )
      .map((rate) => ({
        ...rate,
        ...intersection(
          rate,
          profiles.find((profile) => profile.id === rate.profileId)!,
        ),
      }));
    const margin = coverageCheck(
      'margin',
      approved.map((rate) =>
        intersection(
          rate,
          profiles.find((profile) => profile.id === rate.profileId)!,
        ),
      ),
      query,
      rates.length > 0,
    );
    if (margin.status !== 'ready')
      return [
        margin,
        check(
          'fx',
          'not_checked',
          'Complete approved margin/unit coverage before evaluating currency conversion.',
        ),
      ];
    const policies = facts.policies.valuation;
    if (coverageCheck('valuation_policy', policies, query).status !== 'ready')
      return [
        margin,
        check(
          'fx',
          'not_checked',
          'Approve valuation policy coverage before checking its reporting currencies and FX table.',
        ),
      ];
    const rows = await this.store.rows(
      overlapping(
        this.store
          .query(FxRate, context)
          .andWhere('r.state = :state', { state: 'approved' }),
        query,
      ),
    );
    return [margin, this.fxCheck(query, approved, { policies, rows })];
  }
  private fxCheck(
    query: EquipmentReadinessQueryDto,
    rates: ValuationRate[],
    facts: { policies: PolicyFacts['valuation']; rows: FxRate[] },
  ) {
    const reasons = new Set<string>();
    let provisional = false;
    for (const span of facts.policies) {
      const policy = parseValuationPolicy(span.policy.body, {
        id: span.policy.id,
        version: span.policy.version,
        approved: true,
      });
      if (policy.fx?.dateRule === 'period_average')
        return check(
          'fx',
          'not_checked',
          'This policy uses a full production-month FX average. Verify the selected period calculation; window-only FX coverage cannot prove that monthly average.',
        );
      const fx = facts.rows
        .filter((row) => row.rateType === (policy.fx?.rateType ?? 'economic'))
        .map(fxView);
      const from = span.effectiveFrom.getTime(),
        to = span.effectiveTo!.getTime();
      const cuts = [
        ...new Set([
          from,
          ...[...rates, ...facts.rows]
            .flatMap((row) => [
              row.effectiveFrom.getTime(),
              row.effectiveTo?.getTime() ?? to,
            ])
            .filter((at) => at > from && at < to),
        ]),
      ];
      for (const at of cuts) {
        const rate = rates.find(
          (row) =>
            row.effectiveFrom.getTime() <= at &&
            (!row.effectiveTo || row.effectiveTo.getTime() > at),
        );
        if (!rate?.currency) {
          reasons.add('margin gap');
          continue;
        }
        for (const currency of policy.currencies) {
          const conversion = convert(
            new Dec(1),
            { from: rate.currency, to: currency },
            new Date(at),
            { fx, fxPolicy: policy.fxPolicy },
          );
          if (conversion.reason)
            reasons.add(`${rate.currency} → ${currency}: ${conversion.reason}`);
          provisional ||= conversion.provisional;
        }
      }
    }
    if (reasons.size)
      return check(
        'fx',
        'needs_attention',
        `Missing effective FX conversion: ${[...reasons].slice(0, 5).join('; ')}.`,
      );
    return check(
      'fx',
      provisional ? 'needs_attention' : 'ready',
      provisional
        ? 'FX conversion is covered but uses an authorized provisional rate. Financial values remain provisional.'
        : 'Approved final direct/inverse FX rates cover margin conversion to every reporting currency for this window. Other valuation/disposition evidence is checked in the period.',
      1,
    );
  }
}
function fxView(row: FxRate): FxRateSnapshot {
  return {
    id: row.id,
    version: row.version,
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: row.rate,
    from: row.effectiveFrom.toISOString(),
    to: row.effectiveTo?.toISOString() ?? null,
    ...(row.provisional ? { provisional: true as const } : {}),
  };
}
