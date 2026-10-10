import type { RCA } from '../MasterDataService';

/**
 * v1 `/api/rcas` contract for flag-off plants (decision C4; plan 3.9 step 1). The old builders sent
 * `teamMembers`, `tenantId`, `organizationId`, `targetCompletionDate`, `additionalData` … which the
 * backend DTO (whitelist + forbidNonWhitelisted) rejected with 400: every RCA save from the v1 screen
 * failed. These builders send exactly the declared fields; the tenant comes from the token.
 */
export interface RCADto {
  id: string;
  title: string;
  description?: string | null;
  eventId?: string | null;
  status?: string | null;
  priority?: string | null;
  teamLeadId?: string | null;
  /** JSON text of the member ids */
  teamMemberIds?: string | string[] | null;
  targetCloseDate?: string | null;
  actualCloseDate?: string | null;
  rootCause?: string | null;
  recommendations?: string | null;
  logicTree?: string | null;
  evidence?: string | null;
  templateId?: string | null;
  teamCharter?: string | null;
  tenantId?: string | null;
  organizationId?: string | null;
  unitId?: string | null;
  assetId?: string | null;
  createdAt: string;
  updatedAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseArray<T>(value: string | string[] | null | undefined): T[] {
  if (Array.isArray(value)) return value as unknown as T[];
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

const iso = (value: string | null | undefined) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const mapRcaDto = (dto: RCADto): RCA => ({
  id: dto.id,
  title: dto.title,
  description: dto.description ?? '',
  eventId: dto.eventId ?? '',
  status: (dto.status ?? 'Draft') as RCA['status'],
  priority: (dto.priority ?? 'Medium') as RCA['priority'],
  teamLeadId: dto.teamLeadId ?? '',
  teamMemberIds: parseArray<string>(dto.teamMemberIds),
  targetCloseDate: iso(dto.targetCloseDate),
  actualCloseDate: iso(dto.actualCloseDate),
  rootCause: dto.rootCause ?? undefined,
  recommendations: parseArray(dto.recommendations),
  logicTree: parseArray(dto.logicTree),
  evidence: parseArray(dto.evidence),
  templateId: dto.templateId ?? undefined,
  teamCharter: dto.teamCharter ?? undefined,
  tenantId: dto.tenantId ?? undefined,
  createdAt: iso(dto.createdAt) ?? '',
  updatedAt: iso(dto.updatedAt) ?? '',
});

type RcaInput = Partial<Omit<RCA, 'id' | 'createdAt' | 'updatedAt'>>;

const text = (value: unknown) => (value === undefined ? undefined : JSON.stringify(value));

/** Only the v1 DTO fields (`CreateRcaDto`), undefined left out; arrays are sent as arrays. */
function v1Fields(data: RcaInput): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    title: data.title,
    description: data.description || undefined,
    eventId: data.eventId && UUID.test(data.eventId) ? data.eventId : undefined,
    status: data.status,
    priority: data.priority,
    teamLeadId: data.teamLeadId && UUID.test(data.teamLeadId) ? data.teamLeadId : undefined,
    teamMemberIds: data.teamMemberIds?.filter((id) => UUID.test(id)),
    targetCloseDate: iso(data.targetCloseDate),
    actualCloseDate: iso(data.actualCloseDate),
    rootCause: data.rootCause,
    recommendations: data.recommendations,
    logicTree: data.logicTree,
    evidence: data.evidence,
    templateId: data.templateId && UUID.test(data.templateId) ? data.templateId : undefined,
    teamCharter: data.teamCharter,
    eventDiagram: text(data.eventDiagram),
    phaseTimeline: text(data.phaseTimeline),
    trackingNotes: data.trackingNotes,
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

export const buildCreateRcaPayload = (data: Omit<RCA, 'id' | 'createdAt' | 'updatedAt'>) => v1Fields(data);

export const buildUpdateRcaPayload = (data: Partial<RCA>) => v1Fields(data);
