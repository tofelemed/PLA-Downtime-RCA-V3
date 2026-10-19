import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { AccountingPolicy } from '../periods/entities/accounting-policy.entity';
import { invalid } from '../profiles/profile-errors';
import { assertTenantWideWriter } from '../profiles/profile-scope';
import { DemandStatusesService } from './demand-statuses.service';
import { DemandStatus } from './entities/demand-status.entity';
import { FxRate } from './entities/fx-rate.entity';
import { FxRatesService } from './fx-rates.service';
import { ValuationPoliciesService } from './valuation-policies.service';

/** Descriptive text of a policy version: its notes and, for a backdated version, the backdate reason. */
export interface PolicyTextCorrection {
  notes?: string | null;
  backdateReason?: string;
}

/** Trimmed text; 422 TEXT_REQUIRED when a required text is blank. */
function requiredText(value: string, field: string): string {
  const text = value.trim();
  if (!text) throw invalid('TEXT_REQUIRED', `${field} must not be empty`);
  return text;
}

/**
 * Corrections of the descriptive text of finance records (QA re-test N3): the FX rate's source, the
 * demand status's evidence and the valuation policy's notes / backdate reason. Figures, validity, state
 * and approval never change, so nothing is revalued and an approved record stays approved; the global
 * audit interceptor records who corrected what. Finance maintainers with a tenant-wide grant only.
 */
@Injectable()
export class FinanceTextCorrectionsService {
  constructor(
    private readonly fxRates: FxRatesService,
    private readonly demand: DemandStatusesService,
    private readonly policies: ValuationPoliciesService,
    @InjectRepository(FxRate) private readonly rates: Repository<FxRate>,
    @InjectRepository(DemandStatus)
    private readonly statuses: Repository<DemandStatus>,
    @InjectRepository(AccountingPolicy)
    private readonly policyRows: Repository<AccountingPolicy>,
  ) {}

  async fxSource(
    context: RequestContext,
    id: string,
    source: string,
  ): Promise<FxRate> {
    assertTenantWideWriter(context, requireTenantId(context));
    const rate = await this.fxRates.get(context, id);
    await this.rates.update(
      { id: rate.id, tenantId: rate.tenantId },
      { source: requiredText(source, 'source') },
    );
    return this.fxRates.get(context, id);
  }

  async demandEvidence(
    context: RequestContext,
    id: string,
    evidence: string,
  ): Promise<DemandStatus> {
    assertTenantWideWriter(context, requireTenantId(context));
    const status = await this.demand.get(context, id);
    await this.statuses.update(
      { id: status.id, tenantId: status.tenantId },
      { evidence: requiredText(evidence, 'evidence') },
    );
    return this.demand.get(context, id);
  }

  async policyText(
    context: RequestContext,
    id: string,
    input: PolicyTextCorrection,
  ): Promise<AccountingPolicy> {
    assertTenantWideWriter(context, requireTenantId(context));
    const policy = await this.policies.get(context, id);
    const patch: Partial<Pick<AccountingPolicy, 'notes' | 'backdateReason'>> =
      {};
    if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
    if (input.backdateReason !== undefined) {
      if (!policy.backdateReason) {
        throw invalid(
          'NOT_BACKDATED',
          'this policy version has no backdate reason to correct',
        );
      }
      patch.backdateReason = requiredText(
        input.backdateReason,
        'backdateReason',
      );
    }
    if (Object.keys(patch).length === 0) {
      throw invalid('NOTHING_TO_CORRECT', 'name notes or backdateReason');
    }
    await this.policyRows.update(
      { id: policy.id, tenantId: policy.tenantId },
      patch,
    );
    return this.policies.get(context, id);
  }
}
