import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import {
  diagnostic,
  MappingDiagnostic,
} from '../attribute-mapping/attribute-conversion';
import { CodeEntry, matchCode } from '../code-library/code-matching';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';
import { EventFacts } from '../production-event/revisions/event-facts';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { codeTokenOf } from './source-coding';

interface TenantCodes {
  reasonCodeId: CodeEntry[];
  impactCodeId: CodeEntry[];
  oeeCodeId: CodeEntry[];
  loadedAt: number;
}

type CodeField = 'reasonCodeId' | 'impactCodeId' | 'oeeCodeId';

/** Source fact → the id field it resolves to. */
const CODE_FACTS: ReadonlyArray<[fact: string, field: CodeField]> = [
  ['reason', 'reasonCodeId'],
  ['impactCode', 'impactCodeId'],
  ['oeeCode', 'oeeCodeId'],
];

export interface CodeResolution {
  ids: Partial<Record<CodeField, string>>;
  diagnostics: MappingDiagnostic[];
}

interface LibraryRow extends ObjectLiteral {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  updatedAt: Date;
}

/**
 * Resolves delivered code values (text or digital-state Name) to the tenant's code ids (plan 1.3):
 * exact code or name, case-insensitive, among the tenant's own codes effective at the event start. No
 * substring matching and no shared (tenant-less) codes. Unresolved and ambiguous values are reported
 * as diagnostics with suggestions; the event stays uncoded instead of receiving a guessed code.
 * Cache: per tenant, TTL 60 s (new or retired codes are picked up within a minute).
 */
@Injectable()
export class MasterDataCodeResolverService {
  private readonly cache = new Map<string, TenantCodes>();
  private readonly ttlMs = 60 * 1000;

  constructor(
    @InjectRepository(ReasonCode)
    private readonly reasonCodes: Repository<ReasonCode>,
    @InjectRepository(ImpactCode)
    private readonly impactCodes: Repository<ImpactCode>,
    @InjectRepository(OEECode)
    private readonly oeeCodes: Repository<OEECode>,
  ) {}

  async resolveFacts(
    tenantId: string,
    facts: EventFacts,
    at: Date,
  ): Promise<CodeResolution> {
    const resolution: CodeResolution = { ids: {}, diagnostics: [] };
    const present = CODE_FACTS.filter(([fact]) => codeTokenOf(facts[fact]));
    if (present.length === 0) return resolution;
    const codes = await this.codesOf(tenantId);
    for (const [fact, field] of present) {
      const value = codeTokenOf(facts[fact]) ?? '';
      const match = matchCode(codes[field], value, at);
      if (match.status === 'resolved') {
        resolution.ids[field] = match.id;
      } else if (match.status === 'ambiguous') {
        resolution.diagnostics.push(
          diagnostic(
            'CODE_AMBIGUOUS',
            fact,
            `"${value}" matches ${match.candidates.join(', ')}`,
          ),
        );
      } else {
        const hint = match.suggestions.length
          ? `; did you mean ${match.suggestions.join(', ')}?`
          : '';
        resolution.diagnostics.push(
          diagnostic(
            'CODE_UNRESOLVED',
            fact,
            `"${value}" is not a code of this tenant${hint}`,
          ),
        );
      }
    }
    return resolution;
  }

  private async codesOf(tenantId: string): Promise<TenantCodes> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.ttlMs) return cached;
    const [reasons, impacts, oees] = await Promise.all([
      loadEntries(this.reasonCodes, tenantId),
      loadEntries(this.impactCodes, tenantId),
      loadEntries(this.oeeCodes, tenantId),
    ]);
    const entry: TenantCodes = {
      reasonCodeId: reasons,
      impactCodeId: impacts,
      oeeCodeId: oees,
      loadedAt: Date.now(),
    };
    this.cache.set(tenantId, entry);
    return entry;
  }
}

/** Codes of one tenant; a legacy deactivated code without `effective_to` counts as retired since its last update. */
async function loadEntries<T extends LibraryRow>(
  repository: Repository<T>,
  tenantId: string,
): Promise<CodeEntry[]> {
  const rows = await repository
    .createQueryBuilder('code')
    .where('code.tenantId = :tenantId', { tenantId })
    .getMany();
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    effectiveFrom: row.effectiveFrom ?? null,
    effectiveTo: row.effectiveTo ?? (row.isActive ? null : row.updatedAt),
  }));
}
