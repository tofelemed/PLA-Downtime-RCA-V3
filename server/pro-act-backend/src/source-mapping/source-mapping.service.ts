import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AfBinding } from '../af-binding/af-binding.entity';
import { Asset } from '../asset/asset.entity';
import { Unit } from '../unit/unit.entity';
import {
  MappingResolution,
  MappingResolver,
  MappingSample,
} from './mapping-resolver';
import { MappingRule, MappingTargetType, MatchKind } from './mapping-rule';
import { SourceMapping } from './source-mapping.entity';

/** Outcome of mapping one source record onto the plant hierarchy. */
export type ResolvedMapping =
  | {
      status: 'mapped';
      tier: MatchKind;
      unitId: string;
      assetId: string | null;
      mappingId: string;
      version: number;
      origin: MappingRule['origin'];
    }
  | { status: 'ambiguous'; tier: MatchKind; candidates: MappingCandidate[] }
  | { status: 'invalid_target'; tier: MatchKind; mappingId: string }
  | { status: 'unmapped' };

export interface MappingCandidate {
  mappingId: string;
  origin: MappingRule['origin'];
  targetType: MappingTargetType;
  targetId: string;
  precedence: number;
}

/** Units of the tenant and the unit of each asset of the tenant that rules point at. */
interface TargetDirectory {
  units: ReadonlySet<string>;
  assetUnits: ReadonlyMap<string, string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A loaded resolver for one tenant/connection; reuse it for every record of one pull. */
export class TenantMappingResolver {
  constructor(
    private readonly resolver: MappingResolver,
    private readonly targets: TargetDirectory,
  ) {}

  resolve(sample: MappingSample): ResolvedMapping {
    return this.toResolved(this.resolver.resolve(sample));
  }

  private toResolved(resolution: MappingResolution): ResolvedMapping {
    if (resolution.status === 'unmapped') return resolution;
    if (resolution.status === 'ambiguous') {
      return {
        status: 'ambiguous',
        tier: resolution.tier,
        candidates: resolution.candidates.map(candidateOf),
      };
    }
    const { rule, tier } = resolution;
    const unitId =
      rule.targetType === 'unit'
        ? this.targets.units.has(rule.targetId)
          ? rule.targetId
          : undefined
        : this.targets.assetUnits.get(rule.targetId);
    if (!unitId) {
      return { status: 'invalid_target', tier, mappingId: rule.id };
    }
    return {
      status: 'mapped',
      tier,
      unitId,
      assetId: rule.targetType === 'asset' ? rule.targetId : null,
      mappingId: rule.id,
      version: rule.version,
      origin: rule.origin,
    };
  }
}

/**
 * Loads the mapping rules of a tenant (spec ING03): active `source_mappings` effective at the instant for
 * the connection (or any connection) plus the approved AF bindings, and checks every target against the
 * tenant: a unit or asset of another tenant never resolves (cross-tenant targets are `invalid_target`);
 * an asset target yields its parent unit (I6).
 */
@Injectable()
export class SourceMappingService {
  constructor(
    @InjectRepository(SourceMapping)
    private readonly mappings: Repository<SourceMapping>,
    @InjectRepository(AfBinding)
    private readonly bindings: Repository<AfBinding>,
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
    @InjectRepository(Asset) private readonly assets: Repository<Asset>,
  ) {}

  /**
   * `sourceSystem` selects the rules of one source (`source_mappings.source_system`, e.g. `MQTT`) plus
   * the `*` rules; PI by default. AF bindings are always included (they only match PI element ids).
   */
  async loadResolver(
    tenantId: string,
    connectionId: string | null,
    at: Date = new Date(),
    sourceSystem = 'PI',
  ): Promise<TenantMappingResolver> {
    const rules = [
      ...(await this.sourceMappingRules(
        tenantId,
        connectionId,
        at,
        sourceSystem,
      )),
      ...(await this.bindingRules(tenantId)),
    ];
    const targets = await this.targetDirectory(tenantId, rules);
    return new TenantMappingResolver(new MappingResolver(rules), targets);
  }

  private async sourceMappingRules(
    tenantId: string,
    connectionId: string | null,
    at: Date,
    sourceSystem: string,
  ): Promise<MappingRule[]> {
    const rows = await this.mappings
      .createQueryBuilder('sm')
      .where('sm.tenantId = :tenantId', { tenantId })
      .andWhere('sm.isActive = true')
      .andWhere('sm.sourceSystem IN (:...systems)', {
        systems: [sourceSystem, '*'],
      })
      .andWhere('(sm.effectiveFrom IS NULL OR sm.effectiveFrom <= :at)', { at })
      .andWhere('(sm.effectiveTo IS NULL OR sm.effectiveTo > :at)', { at })
      .andWhere(
        new Brackets((qb) => {
          qb.where('sm.connectionId IS NULL');
          if (connectionId) {
            qb.orWhere('sm.connectionId = :connectionId', { connectionId });
          }
        }),
      )
      .getMany();
    return rows.map(ruleOf);
  }

  private async bindingRules(tenantId: string): Promise<MappingRule[]> {
    const rows = await this.bindings.find({
      where: {
        tenantId,
        isActive: true,
        boundType: In(['unit', 'asset']),
      },
    });
    return rows
      .filter((row) => row.webId && row.localId && UUID.test(row.localId))
      .map((row) => ({
        id: row.id,
        kind: 'af_binding' as const,
        normalizedValue: (row.webId ?? '').trim(),
        precedence: 0,
        connectionId: null,
        targetType: row.boundType === 'asset' ? 'asset' : 'unit',
        targetId: row.localId ?? '',
        version: 1,
        origin: 'af_binding' as const,
      }));
  }

  private async targetDirectory(
    tenantId: string,
    rules: readonly MappingRule[],
  ): Promise<TargetDirectory> {
    const ids = (type: MappingTargetType) => [
      ...new Set(
        rules.filter((r) => r.targetType === type).map((r) => r.targetId),
      ),
    ];
    const unitIds = ids('unit');
    const assetIds = ids('asset');
    const units =
      unitIds.length > 0 && UUID.test(tenantId)
        ? await this.units.find({
            where: { tenantId, id: In(unitIds) },
            select: { id: true },
          })
        : [];
    const assets =
      assetIds.length > 0
        ? await this.assets.find({
            where: { tenantId, id: In(assetIds) },
            select: { id: true, unitId: true },
          })
        : [];
    return {
      units: new Set(units.map((unit) => unit.id)),
      assetUnits: new Map(assets.map((asset) => [asset.id, asset.unitId])),
    };
  }
}

function ruleOf(row: SourceMapping): MappingRule {
  return {
    id: row.id,
    kind: row.matchKind,
    normalizedValue: row.normalizedValue,
    precedence: row.precedence,
    connectionId: row.connectionId,
    targetType: row.targetType,
    targetId: row.targetId,
    version: row.version,
    origin: 'source_mapping',
  };
}

function candidateOf(rule: MappingRule): MappingCandidate {
  return {
    mappingId: rule.id,
    origin: rule.origin,
    targetType: rule.targetType,
    targetId: rule.targetId,
    precedence: rule.precedence,
  };
}
