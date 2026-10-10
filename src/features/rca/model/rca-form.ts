import type { RcaCaseBody } from '@/api/v2/queries/rca-commands';
import type {
  RcaCaseView,
  RcaEvidenceItem,
  RcaLogicNode,
  RcaPriority,
  RcaRecommendationItem,
  RcaStatus,
} from '@/api/v2/types/rca';

/** What the case form edits (plan 3.9 step 1): the v2 contract fields, no tenant / organization. */
export interface RcaCaseForm {
  title: string;
  description: string;
  status: RcaStatus;
  priority: RcaPriority;
  unitId: string | null;
  assetId: string | null;
  teamLeadId: string | null;
  teamMemberIds: string[];
  /** ISO instant or '' */
  targetCloseDate: string;
  rootCause: string;
  recommendations: RcaRecommendationItem[];
  evidence: RcaEvidenceItem[];
  logicTree: RcaLogicNode[];
}

export function emptyCaseForm(unitId: string | null): RcaCaseForm {
  return {
    title: '',
    description: '',
    status: 'Draft',
    priority: 'Medium',
    unitId,
    assetId: null,
    teamLeadId: null,
    teamMemberIds: [],
    targetCloseDate: '',
    rootCause: '',
    recommendations: [],
    evidence: [],
    logicTree: [],
  };
}

const asStatus = (value: string | null): RcaStatus =>
  (['Draft', 'In Progress', 'Analysis', 'Published', 'Closed'] as const).find((s) => s === value) ?? 'Draft';
const asPriority = (value: string | null): RcaPriority =>
  (['Low', 'Medium', 'High', 'Critical'] as const).find((p) => p === value) ?? 'Medium';

export function formFromCase(view: RcaCaseView): RcaCaseForm {
  return {
    title: view.title,
    description: view.description ?? '',
    status: asStatus(view.status),
    priority: asPriority(view.priority),
    unitId: view.unitId,
    assetId: view.assetId,
    teamLeadId: view.teamLeadId,
    teamMemberIds: view.teamMemberIds,
    targetCloseDate: view.targetCloseDate ?? '',
    rootCause: view.rootCause ?? '',
    recommendations: view.recommendations,
    evidence: view.evidence,
    logicTree: view.logicTree,
  };
}

const textOrNull = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * The v2 body the server validates (`RcaCaseV2CreateDto`, whitelist + forbidNonWhitelisted): only the
 * declared fields, empty text as null, nested items as their declared fields. This is the builder whose
 * v1 predecessor sent `teamMembers`, `tenantId`, `targetCompletionDate` … and made every save fail (400).
 */
export function buildRcaCaseBody(form: RcaCaseForm): RcaCaseBody {
  return {
    title: form.title.trim(),
    description: textOrNull(form.description),
    status: form.status,
    priority: form.priority,
    unitId: form.unitId,
    assetId: form.assetId,
    teamLeadId: form.teamLeadId,
    teamMemberIds: form.teamMemberIds,
    targetCloseDate: textOrNull(form.targetCloseDate),
    rootCause: textOrNull(form.rootCause),
    recommendations: form.recommendations.map((item) => ({ ...item })),
    evidence: form.evidence.map((item) => ({ ...item })),
    logicTree: form.logicTree.map((node) => ({ ...node })),
  };
}

/** A new item with a local id (ids are client labels; the server keeps them as given). */
export function newItemId(prefix: string, existing: readonly { id: string }[]): string {
  const used = new Set(existing.map((item) => item.id));
  let index = existing.length + 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}
