import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PIMapping } from '../pi-mapping/pi-mapping.entity';
import {
  parseTenantMappingRules,
  resolveEventType,
  TenantMappingConfig,
} from '../integration/pi-event-mapper';
import { AttributeMappingVersion } from './attribute-mapping-version.entity';
import { defaultRulesFor, mergeRules } from './attribute-rules';
import { FieldRule } from './field-rule';

/** The mapping rules of one tenant (and connection) at one instant, per template. */
export class MappingProfile {
  constructor(
    private readonly legacy: TenantMappingConfig,
    private readonly overrides: ReadonlyMap<string, AttributeMappingVersion>,
  ) {}

  eventTypeOf(templateName: string): string {
    return resolveEventType(templateName, this.legacy);
  }

  /** Catalog defaults < legacy `pi_mappings` overrides < the tenant's versioned rules, per field. */
  rulesFor(templateName: string): FieldRule[] {
    return mergeRules(
      defaultRulesFor(templateName),
      this.legacy.rulesByTemplate[templateName] ?? [],
      this.overrides.get(templateName)?.fieldRules ?? [],
    );
  }

  /** The versioned override in force for a template (null: defaults and legacy rules only). */
  versionOf(templateName: string): AttributeMappingVersion | null {
    return this.overrides.get(templateName) ?? null;
  }
}

/** Loads typed attribute mapping profiles (spec ING04, plan 1.3). */
@Injectable()
export class AttributeMappingService {
  constructor(
    @InjectRepository(AttributeMappingVersion)
    private readonly versions: Repository<AttributeMappingVersion>,
    @InjectRepository(PIMapping)
    private readonly legacyMappings: Repository<PIMapping>,
  ) {}

  async loadProfile(
    tenantId: string,
    connectionId: string | null,
    at: Date = new Date(),
  ): Promise<MappingProfile> {
    const legacy = await this.legacyMappings.findOne({
      where: { tenantId, isActive: true },
      order: { createdAt: 'ASC' },
    });
    const overrides = await this.effectiveVersions(tenantId, connectionId, at);
    return new MappingProfile(
      parseTenantMappingRules(legacy?.mappingRules),
      new Map(overrides.map((row) => [row.templateName, row])),
    );
  }

  /** Highest version per template effective at `at` for the connection (or every connection). */
  effectiveVersions(
    tenantId: string,
    connectionId: string | null,
    at: Date,
  ): Promise<AttributeMappingVersion[]> {
    return this.versions
      .createQueryBuilder('amv')
      .distinctOn(['amv.templateName'])
      .where('amv.tenantId = :tenantId', { tenantId })
      .andWhere('amv.effectiveFrom <= :at', { at })
      .andWhere('(amv.effectiveTo IS NULL OR amv.effectiveTo > :at)', { at })
      .andWhere(
        new Brackets((qb) => {
          qb.where('amv.connectionId IS NULL');
          if (connectionId) {
            qb.orWhere('amv.connectionId = :connectionId', { connectionId });
          }
        }),
      )
      .orderBy('amv.templateName', 'ASC')
      .addOrderBy('amv.version', 'DESC')
      .getMany();
  }
}
