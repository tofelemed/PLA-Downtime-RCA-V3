import type { LogicTreeNode, RcaTemplateView } from '../api/master-data-types';
import { requiredText, textOrNull, type FieldErrors } from '../model/field-errors';
import { logicTreeBodyOf } from './logic-tree-model';

export interface TemplateDraft {
  name: string;
  category: string;
  description: string;
  checklistIds: string[];
  logicTree: LogicTreeNode[];
}

export interface TemplateBody {
  name: string;
  category: string;
  description: string | null;
  checklistIds: string[];
  logicTree: LogicTreeNode[];
}

export function templateDraftOf(template: RcaTemplateView | null): TemplateDraft {
  return {
    name: template?.name ?? '',
    category: template?.category ?? '',
    description: template?.description ?? '',
    checklistIds: template?.checklistIds ?? [],
    logicTree: template?.logicTree ?? [],
  };
}

export function validateTemplate(draft: TemplateDraft): FieldErrors {
  return { name: requiredText(draft.name, 'Name'), category: requiredText(draft.category, 'Category') };
}

export function templateBodyOf(draft: TemplateDraft): TemplateBody {
  return {
    name: draft.name.trim(),
    category: draft.category.trim(),
    description: textOrNull(draft.description),
    checklistIds: draft.checklistIds,
    logicTree: logicTreeBodyOf(draft.logicTree),
  };
}

/** A PATCH of a template: the scalar fields that changed, the tree and checklists always (whole values). */
export function templateChangeOf(draft: TemplateDraft, stored: RcaTemplateView): Partial<TemplateBody> {
  const body = templateBodyOf(draft);
  return {
    ...(body.name !== stored.name ? { name: body.name } : {}),
    ...(body.category !== stored.category ? { category: body.category } : {}),
    ...(body.description !== stored.description ? { description: body.description } : {}),
    checklistIds: body.checklistIds,
    logicTree: body.logicTree,
  };
}
