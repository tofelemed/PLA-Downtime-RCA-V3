import { v2Request } from '@/api/v2/client';
import type { CauseCategory, RcaCauseView, RcaTemplateView } from '../api/master-data-types';
import { RCA_CAUSES, RCA_TEMPLATES } from '../api/record-resource';
import { downloadJson, fetchAll, readJsonArray, textField, tryCreate } from './json-transfer';
import { CAUSE_CATEGORIES, sanitizeTree } from './logic-tree-model';

export interface ImportResult {
  created: number;
  skipped: number;
}

/** Every template of the plant with its logic tree (checklists are plant records: names only stay in the tree). */
export async function exportTemplates(): Promise<void> {
  const list = await fetchAll<RcaTemplateView>(RCA_TEMPLATES, { status: 'all', sort: 'name' });
  const full = [];
  for (const template of list) {
    const detail = (await v2Request<RcaTemplateView>({ method: 'GET', path: `${RCA_TEMPLATES.path}/${template.id}` })).data;
    full.push({ name: detail.name, category: detail.category, description: detail.description, logicTree: detail.logicTree ?? [] });
  }
  downloadJson('rca-templates.json', full);
}

/** Creates one template per valid entry (`logicTree`, or the v1 export's `logicTreeStructure.nodes`). */
export async function importTemplates(file: File): Promise<ImportResult> {
  const records = await readJsonArray(file);
  let created = 0;
  for (const record of records) {
    const name = textField(record, 'name');
    const category = textField(record, 'category') || 'General';
    if (!name) continue;
    const raw = record as Record<string, unknown>;
    const v1 = raw.logicTreeStructure as Record<string, unknown> | undefined;
    const logicTree = sanitizeTree(raw.logicTree ?? v1?.nodes);
    const description = textField(record, 'description') || undefined;
    if (await tryCreate(RCA_TEMPLATES, { name, category, description, logicTree })) created += 1;
  }
  return { created, skipped: records.length - created };
}

/** The whole cause library as a flat list; `parentCode` keeps the tree. */
export async function exportCauses(): Promise<void> {
  const causes = await fetchAll<RcaCauseView>(RCA_CAUSES, { status: 'all', sort: 'code' });
  const codeOf = new Map(causes.map((cause) => [cause.id, cause.code]));
  downloadJson(
    'rca-cause-library.json',
    causes.map((cause) => ({
      code: cause.code,
      name: cause.name,
      category: cause.category,
      description: cause.description,
      parentCode: cause.parentId ? codeOf.get(cause.parentId) ?? null : null,
    })),
  );
}

/** Creates causes parents first (by `parentCode`); entries whose parent cannot be resolved are skipped. */
export async function importCauses(file: File): Promise<ImportResult> {
  const records = await readJsonArray(file);
  const existing = await fetchAll<RcaCauseView>(RCA_CAUSES, { status: 'active' });
  const idOf = new Map(existing.map((cause) => [cause.code.toLowerCase(), cause.id]));
  let pending = records.filter((record) => textField(record, 'code') && textField(record, 'name'));
  let created = 0;
  let progressed = true;
  while (pending.length > 0 && progressed) {
    progressed = false;
    const next: unknown[] = [];
    for (const record of pending) {
      const parentCode = textField(record, 'parentCode').toLowerCase();
      if (parentCode && !idOf.has(parentCode)) {
        next.push(record);
        continue;
      }
      progressed = true;
      const category = textField(record, 'category') as CauseCategory;
      const cause = await tryCreate<RcaCauseView>(RCA_CAUSES, {
        code: textField(record, 'code'),
        name: textField(record, 'name'),
        category: CAUSE_CATEGORIES.includes(category) ? category : 'Equipment',
        description: textField(record, 'description') || undefined,
        parentId: parentCode ? idOf.get(parentCode) : undefined,
      });
      if (cause) {
        created += 1;
        idOf.set(cause.code.toLowerCase(), cause.id);
      }
    }
    pending = next;
  }
  return { created, skipped: records.length - created };
}
