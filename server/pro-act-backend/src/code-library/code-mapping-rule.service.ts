import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import {
  OEE_COMPONENTS,
  SCHEDULE_CLASSES,
} from '../domain/events/event-classification';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { CursorCodec, invalidCursor } from '../v2/common/cursor-codec';
import { listResponse, ListResponse } from '../v2/common/response';
import { CodeMappingRuleKind } from './code-library-kind';
import { CodeMappingRule } from './code-mapping-rule.entity';
import { invalidReference } from './code-references';

export interface CodeMappingRuleInput {
  ruleKind: CodeMappingRuleKind;
  sourceCodeId: string;
  targetValue?: string;
  targetCodeId?: string;
  effectiveFrom?: string;
}

export interface CodeMappingRuleQuery {
  cursor?: string;
  limit: number;
  ruleKind?: CodeMappingRuleKind;
  sourceCodeId?: string;
  asOf?: string;
}

export interface CodeMappingRuleView {
  id: string;
  ruleKind: CodeMappingRuleKind;
  sourceCodeId: string;
  targetValue: string | null;
  targetCodeId: string | null;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
}

const DECIMAL = /^\d{1,11}(\.\d{1,4})?$/;

/**
 * Versioned code mapping rules (spec §3.2, plan 1.3 step 5). A new rule for an existing (kind, source
 * code) is its next version; earlier versions are never modified, so events classified under them keep
 * their basis (T18 "historical mapping unchanged").
 */
@Injectable()
export class CodeMappingRuleService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async create(
    context: RequestContext,
    input: CodeMappingRuleInput,
  ): Promise<CodeMappingRuleView> {
    const tenantId = requireTenantId(context);
    await this.assertReferences(tenantId, input);
    const at = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();
    const saved = await this.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `code_mapping_rules:${tenantId}:${input.ruleKind}:${input.sourceCodeId}`,
      ]);
      const latest = await manager.getRepository(CodeMappingRule).findOne({
        where: {
          tenantId,
          ruleKind: input.ruleKind,
          sourceCodeId: input.sourceCodeId,
        },
        order: { version: 'DESC' },
      });
      if (latest && latest.effectiveFrom > at) throw outOfOrder(latest);
      const repository = manager.getRepository(CodeMappingRule);
      return repository.save(
        repository.create({
          tenantId,
          ruleKind: input.ruleKind,
          sourceCodeId: input.sourceCodeId,
          targetValue: input.targetValue ?? null,
          targetCodeId: input.targetCodeId ?? null,
          version: (latest?.version ?? 0) + 1,
          effectiveFrom: at,
          effectiveTo: null,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
    return toRuleView(saved);
  }

  async list(
    context: RequestContext,
    query: CodeMappingRuleQuery,
  ): Promise<ListResponse<CodeMappingRuleView>> {
    const qb = scopedQuery(
      this.manager.getRepository(CodeMappingRule),
      'rule',
      { context },
    );
    applyRuleFilters(qb, query);
    if (query.cursor) {
      const { sortValue, id } = CursorCodec.decode(query.cursor);
      if (typeof sortValue !== 'string') throw invalidCursor();
      qb.andWhere(
        '(rule.createdAt > :cursorAt OR (rule.createdAt = :cursorAt AND rule.id > :cursorId))',
        { cursorAt: new Date(sortValue), cursorId: id },
      );
    }
    qb.orderBy('rule.createdAt', 'ASC')
      .addOrderBy('rule.id', 'ASC')
      .take(query.limit + 1);
    const rows = await qb.getMany();
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? CursorCodec.encode({
            sortValue: last.createdAt.toISOString(),
            id: last.id,
          })
        : null;
    return listResponse(page.map(toRuleView), nextCursor, {
      tenantId: requireTenantId(context),
    });
  }

  private async assertReferences(
    tenantId: string,
    input: CodeMappingRuleInput,
  ): Promise<void> {
    const sourceEntity =
      input.ruleKind === 'impact_to_valuation' ? ImpactCode : ReasonCode;
    const sourceOwned = await this.manager
      .getRepository(sourceEntity)
      .existsBy({ id: input.sourceCodeId, tenantId });
    if (!sourceOwned) {
      throw invalidReference(
        'sourceCodeId',
        'sourceCodeId is not a code of this tenant for this rule kind',
      );
    }
    const problem = targetProblem(input);
    if (problem) throw ruleTargetError(problem);
    if (input.ruleKind === 'reason_to_impact') {
      const owned = await this.manager
        .getRepository(ImpactCode)
        .existsBy({ id: input.targetCodeId, tenantId });
      if (!owned) {
        throw invalidReference(
          'targetCodeId',
          'targetCodeId is not an impact code of this tenant',
        );
      }
    }
  }
}

/** asOf → only the version in force per (kind, source code) at that instant. */
function applyRuleFilters(
  qb: SelectQueryBuilder<CodeMappingRule>,
  query: CodeMappingRuleQuery,
): void {
  if (query.ruleKind)
    qb.andWhere('rule.ruleKind = :ruleKind', { ruleKind: query.ruleKind });
  if (query.sourceCodeId) {
    qb.andWhere('rule.sourceCodeId = :sourceCodeId', {
      sourceCodeId: query.sourceCodeId,
    });
  }
  if (!query.asOf) return;
  qb.andWhere('rule.effectiveFrom <= :asOf', { asOf: query.asOf })
    .andWhere('(rule.effectiveTo IS NULL OR rule.effectiveTo > :asOf)')
    .andWhere(
      `rule.version = (SELECT max(r2.version) FROM code_mapping_rules r2
         WHERE r2.tenant_id = rule.tenant_id AND r2.rule_kind = rule.rule_kind
           AND r2.source_code_id = rule.source_code_id AND r2.effective_from <= :asOf)`,
    );
}

function targetProblem(input: CodeMappingRuleInput): string | null {
  const { ruleKind, targetValue, targetCodeId } = input;
  if (ruleKind === 'reason_to_impact') {
    return targetCodeId && !targetValue
      ? null
      : 'reason_to_impact needs targetCodeId only';
  }
  if (targetCodeId) return `${ruleKind} takes targetValue, not targetCodeId`;
  const allowed: Readonly<Record<string, (value: string) => boolean>> = {
    reason_to_oee: (value) =>
      (OEE_COMPONENTS as readonly string[]).includes(value),
    reason_to_schedule_class: (value) =>
      (SCHEDULE_CLASSES as readonly string[]).includes(value),
    impact_to_valuation: (value) => DECIMAL.test(value),
  };
  return targetValue && allowed[ruleKind](targetValue)
    ? null
    : `targetValue is not valid for ${ruleKind}`;
}

function ruleTargetError(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INVALID_RULE_TARGET',
    message: [message],
    fieldErrors: [{ field: 'targetValue', message }],
  });
}

function outOfOrder(latest: CodeMappingRule): UnprocessableEntityException {
  const message = `effectiveFrom must not be before version ${latest.version} (${latest.effectiveFrom.toISOString()})`;
  return new UnprocessableEntityException({
    code: 'INVALID_RANGE',
    message: [message],
    fieldErrors: [{ field: 'effectiveFrom', message }],
  });
}

export function toRuleView(rule: CodeMappingRule): CodeMappingRuleView {
  return {
    id: rule.id,
    ruleKind: rule.ruleKind,
    sourceCodeId: rule.sourceCodeId,
    targetValue: rule.targetValue,
    targetCodeId: rule.targetCodeId,
    version: rule.version,
    effectiveFrom: rule.effectiveFrom.toISOString(),
    effectiveTo: rule.effectiveTo?.toISOString() ?? null,
    createdAt: rule.createdAt.toISOString(),
  };
}
