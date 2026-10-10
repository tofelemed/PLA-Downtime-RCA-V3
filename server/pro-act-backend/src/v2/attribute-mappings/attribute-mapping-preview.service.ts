import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { MappingDiagnostic } from '../../attribute-mapping/attribute-conversion';
import { mapAttributes } from '../../attribute-mapping/attribute-mapper';
import { AttributeMappingService } from '../../attribute-mapping/attribute-mapping.service';
import {
  mergeRules,
  ruleErrors,
} from '../../attribute-mapping/attribute-rules';
import { FieldRule } from '../../attribute-mapping/field-rule';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { AttributeMappingPreviewV2Dto } from './attribute-mapping-v2.dto';

/** What one sample record becomes under the effective (or draft) rules; nothing is stored. */
export interface AttributeMappingPreviewView {
  templateName: string;
  eventType: string;
  /** the rules applied: effective rules with the draft merged over them per field */
  rules: FieldRule[];
  /** target fields the draft changed (override indicator) */
  draftFields: string[];
  /** catalog fields stored in event columns */
  columns: Record<string, unknown>;
  /** catalog fields kept as source facts (reason, codes, supplied duration in seconds) */
  facts: Record<string, unknown>;
  diagnostics: MappingDiagnostic[];
  startTime: string;
  endTime: string | null;
  /** from the timestamps (authoritative); null while open */
  durationSeconds: number | null;
}

/**
 * Typed mapping preview (plan 3.7, PI02 "preview before activation", ING04): runs the same
 * `mapAttributes` as intake on a sample record with the tenant's effective rules for the template,
 * optionally with draft rules merged over them, so a mapping can be checked before a version is saved.
 */
@Injectable()
export class AttributeMappingPreviewService {
  constructor(private readonly mappings: AttributeMappingService) {}

  async preview(
    context: RequestContext,
    dto: AttributeMappingPreviewV2Dto,
  ): Promise<AttributeMappingPreviewView> {
    const tenantId = requireTenantId(context);
    const draft = validDraft(dto);
    const profile = await this.mappings.loadProfile(
      tenantId,
      dto.connectionId ?? null,
    );
    const rules = mergeRules(profile.rulesFor(dto.templateName), draft);
    const start = new Date(dto.startTime);
    const end = dto.endTime ? new Date(dto.endTime) : null;
    if (end && end.getTime() < start.getTime()) {
      throw new UnprocessableEntityException({
        code: 'INVALID_RANGE',
        message: 'endTime must not be before startTime',
      });
    }
    const mapped = mapAttributes(rules, dto.attributes, { start, end });
    return {
      templateName: dto.templateName,
      eventType: profile.eventTypeOf(dto.templateName),
      rules,
      draftFields: draft.map((rule) => rule.targetField),
      columns: mapped.columns,
      facts: { ...mapped.facts },
      diagnostics: mapped.diagnostics,
      startTime: start.toISOString(),
      endTime: end ? end.toISOString() : null,
      durationSeconds: end ? (end.getTime() - start.getTime()) / 1000 : null,
    };
  }
}

function validDraft(dto: AttributeMappingPreviewV2Dto): FieldRule[] {
  const draft: FieldRule[] = (dto.fieldRules ?? []).map((rule) => ({
    ...rule,
  }));
  const errors = ruleErrors(dto.templateName, draft);
  if (errors.length === 0) return draft;
  throw new UnprocessableEntityException({
    code: 'INVALID_FIELD_RULES',
    message: errors,
    fieldErrors: errors.map((message) => ({ field: 'fieldRules', message })),
  });
}
