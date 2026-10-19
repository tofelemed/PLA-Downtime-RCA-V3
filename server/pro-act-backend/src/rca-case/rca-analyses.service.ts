import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
} from 'typeorm';
import { assertRevision, staleRevision } from '../common/concurrency/revision';
import { RequestContext } from '../common/context/request-context';
import { RcaBarrierAnalysis } from '../rca-analysis-methodology/entities/barrier-analysis.entity';
import { RcaChangeAnalysis } from '../rca-analysis-methodology/entities/change-analysis.entity';
import { RcaFaultTreeAnalysis } from '../rca-analysis-methodology/entities/fault-tree-analysis.entity';
import { RcaFishboneDiagram } from '../rca-analysis-methodology/entities/fishbone-diagram.entity';
import { RcaFiveWhyAnalysis } from '../rca-analysis-methodology/entities/five-why-analysis.entity';
import { RcaFmeaAnalysis } from '../rca-analysis-methodology/entities/fmea-analysis.entity';
import {
  BarrierV2Dto,
  ChangeV2Dto,
  FaultTreeV2Dto,
  FishboneV2Dto,
  FiveWhyV2Dto,
  FmeaV2Dto,
} from '../v2/rca/rca-analyses-v2.dto';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { FmeaRules } from '../domain/rca/rca-policy-rules';
import { casePolicy } from './case-policy';
import { recordRcaAudit } from './rca-audit';
import {
  barrierView,
  BarrierView,
  changeView,
  ChangeView,
  faultTreeView,
  FaultTreeView,
  fishboneView,
  FishboneView,
  fiveWhyView,
  FiveWhyView,
  fmeaView,
  FmeaView,
  RcaAnalysesV2View,
} from './rca-analysis.view';
import { findCase, RcaScope, scopeOf } from './rca-scope';
import { assertCaseNotClosed } from './case-closed';

interface AnalysisRow {
  id: string;
  rcaId: string;
  tenantId?: string;
  rowVersion: number;
  updatedAt: Date;
}

type RowClass<E extends AnalysisRow> = new () => E;

/** Which save the caller means: `expected` null = first save (no record yet), else the row version read. */
export interface AnalysisTarget {
  rcaId: string;
  expected: number | null;
}

/**
 * The analysis tool records of a case (plan 3.9 follow-up, v1 parity): the v1 `rca_*` tables (children
 * of their case, tenant enforced by the DB trigger) read and replaced through v2 with the case's scope
 * check and optimistic concurrency. One record per tool and case (the newest when v1 left several).
 */
@Injectable()
export class RcaAnalysesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
  ) {}

  /** CA5 FMEA rules of the case's policy in force now. */
  private async fmeaRules(
    manager: EntityManager,
    rca: { tenantId?: string; unitId?: string | null },
  ): Promise<FmeaRules> {
    return (await casePolicy(manager, this.policies, rca, new Date())).fmea;
  }

  async list(
    context: RequestContext,
    rcaId: string,
  ): Promise<RcaAnalysesV2View> {
    const manager = this.dataSource.manager;
    const rca = await findCase(manager, scopeOf(context), rcaId);
    const rules = await this.fmeaRules(manager, rca);
    const latest = <E extends AnalysisRow>(type: RowClass<E>) =>
      this.latest(manager, type, rcaId);
    const map = <E extends AnalysisRow, V>(
      row: E | null,
      view: (row: E) => V,
    ) => (row ? view(row) : null);
    return {
      fiveWhy: map(await latest(RcaFiveWhyAnalysis), fiveWhyView),
      fishbone: map(await latest(RcaFishboneDiagram), fishboneView),
      fmea: map(await latest(RcaFmeaAnalysis), (row) => fmeaView(row, rules)),
      faultTree: map(await latest(RcaFaultTreeAnalysis), faultTreeView),
      barrier: map(await latest(RcaBarrierAnalysis), barrierView),
      change: map(await latest(RcaChangeAnalysis), changeView),
    };
  }

  async saveFiveWhy(
    context: RequestContext,
    target: AnalysisTarget,
    body: FiveWhyV2Dto,
  ): Promise<FiveWhyView> {
    const values = {
      problem: body.problem,
      whyLevels: body.whyLevels.map((level) => ({
        ...level,
        justification: level.justification ?? null,
      })),
      rootCause: body.rootCause,
    };
    return fiveWhyView(
      await this.upsert(context, target, RcaFiveWhyAnalysis, values),
    );
  }

  async saveFishbone(
    context: RequestContext,
    target: AnalysisTarget,
    body: FishboneV2Dto,
  ): Promise<FishboneView> {
    const values = {
      effect: body.effect,
      categories: body.categories.map((category) => ({ ...category })),
    };
    return fishboneView(
      await this.upsert(context, target, RcaFishboneDiagram, values),
    );
  }

  async saveFmea(
    context: RequestContext,
    target: AnalysisTarget,
    body: FmeaV2Dto,
  ): Promise<FmeaView> {
    // ratings are stored as given (null = not rated); scores are computed when read (CA5)
    const values = {
      failureMode: body.failureMode,
      effects: body.effects.map((effect) => ({
        ...effect,
        severity: effect.severity ?? null,
        detection: effect.detection ?? null,
      })),
      causes: body.causes.map((cause) => ({
        ...cause,
        occurrence: cause.occurrence ?? null,
        detection: cause.detection ?? null,
        detectionControl: cause.detectionControl ?? null,
        recommendedActions: cause.recommendedActions ?? [],
      })),
    };
    const saved = await this.upsert(context, target, RcaFmeaAnalysis, values);
    const rca = await findCase(
      this.dataSource.manager,
      scopeOf(context),
      target.rcaId,
    );
    return fmeaView(saved, await this.fmeaRules(this.dataSource.manager, rca));
  }

  async saveFaultTree(
    context: RequestContext,
    target: AnalysisTarget,
    body: FaultTreeV2Dto,
  ): Promise<FaultTreeView> {
    const values = {
      topEvent: body.topEvent,
      nodes: body.nodes.map((node) => ({
        ...node,
        parentId: node.parentId ?? null,
        probability: node.probability ?? null,
      })),
    };
    return faultTreeView(
      await this.upsert(context, target, RcaFaultTreeAnalysis, values),
    );
  }

  async saveBarrier(
    context: RequestContext,
    target: AnalysisTarget,
    body: BarrierV2Dto,
  ): Promise<BarrierView> {
    const values = {
      hazard: body.hazard,
      barriers: body.barriers.map((barrier) => ({
        ...barrier,
        failureReason: barrier.failureReason ?? null,
        recommendations: barrier.recommendations ?? [],
      })),
    };
    return barrierView(
      await this.upsert(context, target, RcaBarrierAnalysis, values),
    );
  }

  async saveChange(
    context: RequestContext,
    target: AnalysisTarget,
    body: ChangeV2Dto,
  ): Promise<ChangeView> {
    const values = {
      question: body.question,
      changes: body.changes.map((change) => ({ ...change })),
    };
    return changeView(
      await this.upsert(context, target, RcaChangeAnalysis, values),
    );
  }

  private latest<E extends AnalysisRow>(
    manager: EntityManager,
    type: RowClass<E>,
    rcaId: string,
  ): Promise<E | null> {
    return manager.getRepository(type).findOne({
      where: { rcaId } as FindOptionsWhere<E>,
      order: { updatedAt: 'DESC' } as never,
    });
  }

  /** Inserts the first record or replaces the content of the existing one (412 on a stale or wrong guess). */
  private async upsert<E extends AnalysisRow>(
    context: RequestContext,
    target: AnalysisTarget,
    type: RowClass<E>,
    values: object,
  ): Promise<E> {
    const scope: RcaScope = scopeOf(context);
    return this.dataSource.transaction(async (manager) => {
      assertCaseNotClosed(await findCase(manager, scope, target.rcaId, true));
      const existing = await this.latest(manager, type, target.rcaId);
      const repository = manager.getRepository(type);
      if (!existing) {
        if (target.expected !== null)
          throw staleRevision('nothing was saved for this tool yet');
        const created = repository.create({
          ...values,
          rcaId: target.rcaId,
          tenantId: scope.tenantId,
        } as DeepPartial<E>);
        const saved = await repository.save(created);
        return this.audited(manager, scope, type, { before: null, saved });
      }
      if (target.expected === null)
        throw staleRevision('this tool was saved meanwhile');
      assertRevision(existing.rowVersion, target.expected);
      const saved = await repository.save({
        ...existing,
        ...values,
      } as DeepPartial<E>);
      return this.audited(manager, scope, type, { before: existing, saved });
    });
  }

  /** Field history of a tool save (`rca_analysis.saved`, the tool named by its table). */
  private async audited<E extends AnalysisRow>(
    manager: EntityManager,
    scope: RcaScope,
    type: RowClass<E>,
    rows: { before: AnalysisRow | null; saved: E },
  ): Promise<E> {
    const { before, saved } = rows;
    await recordRcaAudit(manager, scope, [
      {
        entityType: 'rca_analysis',
        entityId: saved.id,
        caseId: saved.rcaId,
        action: 'saved',
        before,
        after: saved,
        revision: saved.rowVersion,
        detail: { tool: manager.getRepository(type).metadata.tableName },
      },
    ]);
    return saved;
  }
}
