import { RCACauseCode } from '../../rca-cause-code/rca-cause-code.entity';
import { RCATemplate } from '../../rca-template/rca-template.entity';
import { VerificationStatusCode } from '../../verification-status-code/verification-status-code.entity';

/** One logic-tree node as stored in a template. */
export interface LogicTreeNodeV2View {
  id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
  note?: string;
  finding?: boolean;
  children?: LogicTreeNodeV2View[];
}

/** `GET /api/v2/rca-templates` item (no tree) and, with `logicTree`, `GET /api/v2/rca-templates/{id}`. */
export interface RcaTemplateV2View {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
  nodeCount: number;
  checklistIds: string[];
  logicTree?: LogicTreeNodeV2View[];
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface RcaCauseV2View {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  parentId: string | null;
  isActive: boolean;
  /** active direct sub-causes (the tree shows an expander when > 0) */
  activeChildren: number;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationChecklistV2View {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string | null;
  items: string[];
  isActive: boolean;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** `template_data` as v1 and v2 write it: `{ nodes, checklistIds? }` (v1 never stored checklists). */
export interface TemplateData {
  nodes: LogicTreeNodeV2View[];
  checklistIds: string[];
}

export function templateDataOf(raw: unknown): TemplateData {
  const value =
    typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const nodes = Array.isArray(value.nodes)
    ? (value.nodes as LogicTreeNodeV2View[])
    : [];
  const checklistIds = Array.isArray(value.checklistIds)
    ? value.checklistIds.filter((id): id is string => typeof id === 'string')
    : [];
  return { nodes, checklistIds };
}

export function countNodes(nodes: readonly LogicTreeNodeV2View[]): number {
  return nodes.reduce(
    (sum, node) => sum + 1 + countNodes(node.children ?? []),
    0,
  );
}

export function toTemplateView(
  row: RCATemplate,
  withTree: boolean,
): RcaTemplateV2View {
  const data = templateDataOf(row.logicTreeStructure);
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? null,
    description: row.description ?? null,
    isActive: row.isActive,
    nodeCount: countNodes(data.nodes),
    checklistIds: data.checklistIds,
    ...(withTree ? { logicTree: data.nodes } : {}),
    rowVersion: row.rowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCauseView(
  row: RCACauseCode,
  activeChildren: number,
): RcaCauseV2View {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    parentId: row.parentId ?? null,
    isActive: row.isActive,
    activeChildren,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toChecklistView(
  row: VerificationStatusCode,
): VerificationChecklistV2View {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? null,
    color: row.color ?? null,
    items: Array.isArray(row.items) ? row.items : [],
    isActive: row.isActive,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
