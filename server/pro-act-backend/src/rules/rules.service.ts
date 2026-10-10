import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { keysetPage } from '../v2/common/keyset-page';
import { listResponse, ListResponse } from '../v2/common/response';
import { RuleKind, RuleState } from './grammar/rule-catalog';
import { Rule } from './entities/rule.entity';
import { RuleVersion } from './entities/rule-version.entity';
import { ruleNotFound } from './rule-errors';
import {
  RuleV2View,
  RuleVersionV2View,
  toRuleVersionView,
  toRuleView,
} from './rule-view';

export interface RuleListQuery {
  cursor?: string;
  limit: number;
  kind?: RuleKind;
  state?: RuleState;
}

/** Reads of declarative rules (plan 3.8): tenant from identity, foreign ids are 404. */
@Injectable()
export class RulesService {
  constructor(
    @InjectRepository(Rule) private readonly rules: Repository<Rule>,
    @InjectRepository(RuleVersion)
    private readonly versions: Repository<RuleVersion>,
  ) {}

  async list(
    context: RequestContext,
    query: RuleListQuery,
  ): Promise<ListResponse<RuleV2View>> {
    const qb = scopedQuery(this.rules, 'rule', { context });
    if (query.kind) qb.andWhere('rule.kind = :kind', { kind: query.kind });
    if (query.state) qb.andWhere('rule.state = :state', { state: query.state });
    const page = await keysetPage(qb, {
      alias: 'rule',
      property: 'createdAt',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    const active = await this.activeVersions(page.items);
    return listResponse(
      page.items.map((rule) => toRuleView(rule, active.get(rule.id) ?? null)),
      page.nextCursor,
      { tenantId: requireTenantId(context) },
    );
  }

  async get(context: RequestContext, id: string): Promise<RuleV2View> {
    const rule = await this.find(context, id);
    const active = await this.activeVersions([rule]);
    return toRuleView(rule, active.get(rule.id) ?? null);
  }

  async find(context: RequestContext, id: string): Promise<Rule> {
    const rule = await scopedQuery(this.rules, 'rule', { context })
      .andWhere('rule.id = :id', { id })
      .getOne();
    if (!rule) throw ruleNotFound();
    return rule;
  }

  /** Every approved version, newest first (activation and rollback history). */
  async history(
    context: RequestContext,
    id: string,
  ): Promise<RuleVersionV2View[]> {
    const rule = await this.find(context, id);
    const rows = await this.versions.find({
      where: { tenantId: rule.tenantId, ruleId: rule.id },
      order: { version: 'DESC' },
    });
    return rows.map((row) => toRuleVersionView(row, rule));
  }

  private async activeVersions(
    rules: Rule[],
  ): Promise<Map<string, RuleVersion>> {
    const keyed = rules.filter((rule) => rule.activeVersion !== null);
    if (keyed.length === 0) return new Map();
    const rows = await this.versions.find({
      where: keyed.map((rule) => ({
        tenantId: rule.tenantId,
        ruleId: rule.id,
        version: rule.activeVersion as number,
      })),
    });
    const byRule = new Map<string, RuleVersion>();
    for (const row of rows) byRule.set(row.ruleId, row);
    return byRule;
  }
}
