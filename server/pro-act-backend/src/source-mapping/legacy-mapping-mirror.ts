import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SourceHierarchyMapping } from '../hierarchy-mapping/entities/source-hierarchy-mapping.entity';
import { MatchKind, normalizeMatchValue } from './mapping-rule';
import { SourceMapping } from './source-mapping.entity';
import { legacySourceSystem } from './source-system';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = '23505';

/**
 * `source_mappings` rows a v1 `source_hierarchy_mappings` row stands for (same rules as the backfill in
 * migration `HierarchyMappingAndCodeLibraries`): a pattern row → `pattern`; otherwise its identifier →
 * `exact_id` and its path, when given, → `exact_path`. Rows targeting a tenant or organisation, or
 * owned by a non-uuid tenant, have no equivalent and are skipped.
 */
export function mirroredRows(
  legacy: SourceHierarchyMapping,
): Array<Partial<SourceMapping>> {
  if (!UUID.test(legacy.tenantId)) return [];
  if (legacy.targetType !== 'unit' && legacy.targetType !== 'asset') return [];
  const values: Array<[MatchKind, string | undefined]> = legacy.isPattern
    ? [['pattern', legacy.pattern]]
    : [
        ['exact_id', legacy.sourceIdentifier],
        ['exact_path', legacy.sourcePath],
      ];
  return values
    .filter((entry): entry is [MatchKind, string] => Boolean(entry[1]?.trim()))
    .map(([matchKind, value]) => ({
      tenantId: legacy.tenantId,
      connectionId: legacy.sourceConnectionId ?? null,
      sourceSystem: legacySourceSystem(legacy.sourceType),
      matchKind,
      matchValue: value,
      normalizedValue: normalizeMatchValue(matchKind, value),
      precedence: legacy.priority ?? 0,
      targetType: legacy.targetType as 'unit' | 'asset',
      targetId: legacy.targetId,
      isActive: legacy.isActive,
      description: legacy.description ?? null,
      legacyMappingId: legacy.id,
      createdBy: null,
      updatedBy: null,
    }));
}

/**
 * Expand step of ING03: v1 hierarchy mapping writes keep working and are mirrored into
 * `source_mappings`, which is the only table resolution reads. Removed in 3.10 with the v1 table.
 */
@Injectable()
export class LegacyMappingMirror {
  private readonly logger = new Logger(LegacyMappingMirror.name);

  constructor(
    @InjectRepository(SourceMapping)
    private readonly mappings: Repository<SourceMapping>,
  ) {}

  async sync(legacy: SourceHierarchyMapping): Promise<void> {
    await this.remove(legacy.id);
    for (const row of mirroredRows(legacy)) {
      try {
        await this.mappings.insert(row);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        this.logger.warn(
          `Legacy mapping ${legacy.id} (${row.matchKind} ${row.matchValue}) duplicates an active source mapping; not mirrored`,
        );
      }
    }
  }

  async remove(legacyId: string): Promise<void> {
    await this.mappings.delete({ legacyMappingId: legacyId });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      UNIQUE_VIOLATION
  );
}
