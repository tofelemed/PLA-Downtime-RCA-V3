import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { invalid } from '../profiles/profile-errors';
import { ProductionEvent } from '../production-event/production-event.entity';
import { RuleDefinition } from './grammar/rule-definition';
import { RuleRun, RuleRunScope } from './entities/rule-run.entity';
import { RuleVersion } from './entities/rule-version.entity';
import { Rule } from './entities/rule.entity';
import { noDraft, ruleReferenceInvalid, versionNotFound } from './rule-errors';
import { RuleSimulationResults, simulateOverEvents } from './rule-simulation';
import { RulesService } from './rules.service';

export interface RuleSimulationInput {
  from: string;
  to: string;
  unitIds?: string[];
  /** a version number; omitted = the draft if there is one, else the version in force */
  version?: number;
}

export interface RuleSimulationV2View extends RuleSimulationResults {
  runId: string;
  ruleId: string;
  /** null = the draft */
  version: number | null;
  scope: RuleRunScope;
  ranAt: string;
}

/** Events read per simulation (most recent first); more are reported as `truncated`. */
export const SIMULATION_SAMPLE_LIMIT = 5000;
const MAX_WINDOW_MS = 92 * 24 * 3600 * 1000;

/**
 * Simulation of a rule over stored events of the caller's scope (plan 3.8, NFR02 simulation step):
 * read-only for events, recorded as a `rule_runs` row with its scope and before/after results.
 */
@Injectable()
export class RuleSimulationService {
  constructor(
    private readonly reads: RulesService,
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
    @InjectRepository(RuleVersion)
    private readonly versions: Repository<RuleVersion>,
    @InjectRepository(RuleRun) private readonly runs: Repository<RuleRun>,
  ) {}

  async simulate(
    context: RequestContext,
    id: string,
    input: RuleSimulationInput,
  ): Promise<RuleSimulationV2View> {
    const rule = await this.reads.find(context, id);
    const scope = this.scopeOf(input);
    const target = await this.definitionOf(rule, input.version);
    await this.assertUnits(context, rule.tenantId, scope.unitIds);
    const rows = await this.sample(context, scope);
    const results = simulateOverEvents(
      target.definition,
      rows.slice(0, SIMULATION_SAMPLE_LIMIT),
      rows.length > SIMULATION_SAMPLE_LIMIT,
    );
    const run = await this.runs.save(
      this.runs.create({
        tenantId: rule.tenantId,
        ruleId: rule.id,
        version: target.version,
        definition: target.definition,
        sampleScope: scope,
        results: { ...results },
        ranAt: new Date(),
        createdBy: context.userId,
        updatedBy: context.userId,
      }),
    );
    return {
      ...results,
      runId: run.id,
      ruleId: rule.id,
      version: target.version,
      scope,
      ranAt: run.ranAt.toISOString(),
    };
  }

  private scopeOf(input: RuleSimulationInput): RuleRunScope {
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (!(from < to)) throw invalid('INVALID_RANGE', 'from must be before to');
    if (to.getTime() - from.getTime() > MAX_WINDOW_MS)
      throw invalid('INVALID_RANGE', 'the window is limited to 92 days');
    const unitIds =
      input.unitIds && input.unitIds.length > 0
        ? [...new Set(input.unitIds)]
        : null;
    return { from: from.toISOString(), to: to.toISOString(), unitIds };
  }

  private async definitionOf(
    rule: Rule,
    version?: number,
  ): Promise<{ definition: RuleDefinition; version: number | null }> {
    if (version !== undefined) {
      const row = await this.versions.findOne({
        where: { tenantId: rule.tenantId, ruleId: rule.id, version },
      });
      if (!row) throw versionNotFound(version);
      return { definition: row.definition, version };
    }
    if (rule.draftDefinition)
      return { definition: rule.draftDefinition, version: null };
    if (rule.activeVersion === null) throw noDraft();
    return this.definitionOf(rule, rule.activeVersion);
  }

  private async assertUnits(
    context: RequestContext,
    tenantId: string,
    unitIds: string[] | null,
  ): Promise<void> {
    if (!unitIds) return;
    const rows: Array<{ id: string }> = await this.events.manager.query(
      'SELECT "id"::text AS id FROM "units" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])',
      [tenantId, unitIds],
    );
    const known = new Set(rows.map((row) => row.id));
    const index = unitIds.findIndex((unitId) => !known.has(unitId));
    if (index >= 0) throw ruleReferenceInvalid(`unitIds.${index}`, 'unit');
  }

  /** Latest events overlapping the window, in the caller's unit scope, needed columns only. */
  private sample(
    context: RequestContext,
    scope: RuleRunScope,
  ): Promise<ProductionEvent[]> {
    const qb = scopedQuery(this.events, 'event', {
      context,
      unitProperty: 'unitId',
    })
      .select([
        'event.id',
        'event.unitId',
        'event.assetId',
        'event.startTime',
        'event.endTime',
        'event.eventType',
        'event.source',
        'event.status',
        'event.physicalType',
        'event.scheduleClass',
        'event.oeeComponent',
        'event.impactMode',
        'event.sourceKind',
        'event.reasonCodeId',
        'event.impactCodeId',
      ])
      .andWhere('event.physicalState IN (:...states)', {
        states: ['open', 'closed'],
      })
      .andWhere('event.startTime < :to', { to: scope.to })
      .andWhere('(event.endTime IS NULL OR event.endTime > :from)', {
        from: scope.from,
      });
    if (scope.unitIds)
      qb.andWhere('event.unitId IN (:...unitIds)', { unitIds: scope.unitIds });
    return qb
      .orderBy('event.startTime', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .limit(SIMULATION_SAMPLE_LIMIT + 1)
      .getMany();
  }
}
