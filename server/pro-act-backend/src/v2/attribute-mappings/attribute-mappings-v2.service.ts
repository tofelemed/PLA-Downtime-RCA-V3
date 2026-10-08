import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttributeMappingVersion } from '../../attribute-mapping/attribute-mapping-version.entity';
import { AttributeMappingService } from '../../attribute-mapping/attribute-mapping.service';
import { ruleErrors } from '../../attribute-mapping/attribute-rules';
import { EVENT_FIELD_CATALOG } from '../../attribute-mapping/event-field-catalog';
import { FieldRule } from '../../attribute-mapping/field-rule';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { AttributeMappingV2CreateDto } from './attribute-mapping-v2.dto';

export interface AttributeMappingVersionView {
  id: string;
  templateName: string;
  connectionId: string | null;
  version: number;
  fieldRules: FieldRule[];
  effectiveFrom: string;
  effectiveTo: string | null;
}

/** The rules a template maps with now: catalog defaults < legacy overrides < versioned override. */
export interface EffectiveTemplateMapping {
  templateName: string;
  eventType: string;
  rules: FieldRule[];
  override: AttributeMappingVersionView | null;
}

/** v2 typed attribute mappings (plan 1.3, ING04). */
@Injectable()
export class AttributeMappingsV2Service {
  constructor(
    @InjectRepository(AttributeMappingVersion)
    private readonly versions: Repository<AttributeMappingVersion>,
    private readonly mappings: AttributeMappingService,
  ) {}

  async effective(
    context: RequestContext,
    connectionId: string | null,
  ): Promise<EffectiveTemplateMapping[]> {
    const tenantId = requireTenantId(context);
    const profile = await this.mappings.loadProfile(tenantId, connectionId);
    const overrides = await this.mappings.effectiveVersions(
      tenantId,
      connectionId,
      new Date(),
    );
    const templates = [
      ...new Set([
        ...EVENT_FIELD_CATALOG.templates.map((template) => template.name),
        ...overrides.map((row) => row.templateName),
      ]),
    ];
    return templates.map((templateName) => {
      const override = profile.versionOf(templateName);
      return {
        templateName,
        eventType: profile.eventTypeOf(templateName),
        rules: profile.rulesFor(templateName),
        override: override ? toVersionView(override) : null,
      };
    });
  }

  async createVersion(
    context: RequestContext,
    dto: AttributeMappingV2CreateDto,
  ): Promise<AttributeMappingVersionView> {
    const tenantId = requireTenantId(context);
    const rules = validRules(dto);
    const saved = await this.versions.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `attribute_mapping_versions:${tenantId}:${dto.templateName}`,
      ]);
      const repository = manager.getRepository(AttributeMappingVersion);
      const latest = await repository.findOne({
        where: { tenantId, templateName: dto.templateName },
        order: { version: 'DESC' },
      });
      return repository.save(
        repository.create({
          tenantId,
          templateName: dto.templateName,
          connectionId: dto.connectionId ?? null,
          version: (latest?.version ?? 0) + 1,
          fieldRules: rules,
          effectiveFrom: dto.effectiveFrom
            ? new Date(dto.effectiveFrom)
            : new Date(),
          effectiveTo: null,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
    return toVersionView(saved);
  }
}

/** The body's rules as plain objects; 422 INVALID_FIELD_RULES when the catalog rejects any. */
function validRules(dto: AttributeMappingV2CreateDto): FieldRule[] {
  const rules: FieldRule[] = dto.fieldRules.map((rule) => ({ ...rule }));
  const errors = ruleErrors(dto.templateName, rules);
  if (errors.length > 0) {
    throw new UnprocessableEntityException({
      code: 'INVALID_FIELD_RULES',
      message: errors,
      fieldErrors: errors.map((message) => ({ field: 'fieldRules', message })),
    });
  }
  return rules;
}

function toVersionView(
  row: AttributeMappingVersion,
): AttributeMappingVersionView {
  return {
    id: row.id,
    templateName: row.templateName,
    connectionId: row.connectionId,
    version: row.version,
    fieldRules: row.fieldRules,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
  };
}
