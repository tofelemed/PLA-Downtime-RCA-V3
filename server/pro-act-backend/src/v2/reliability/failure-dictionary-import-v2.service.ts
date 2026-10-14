import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import {
  DictionaryDraft,
  draftKey,
  parseDictionaryImport,
  sameContent,
} from '../../domain/reliability/failure-dictionary-import';
import { FailureDictionaryEntry } from '../../reliability/entities/failure-dictionary-entry.entity';
import { importInvalid } from '../../reliability/failure-dictionary/failure-dictionary-errors';
import { openEntries } from '../../reliability/failure-dictionary/failure-dictionary-reads';
import {
  writerStamp,
  WriterStamp,
} from '../master-data/common/master-data-writer';
import { FailureDictionaryImportDto } from './failure-dictionary-v2.dto';
import { FailureDictionaryImportV2View } from './failure-dictionary-v2.view';

const draftOf = (entry: FailureDictionaryEntry): DictionaryDraft => ({
  kind: entry.entryKind,
  equipmentClass: entry.equipmentClass,
  code: entry.code,
  name: entry.name,
  description: entry.description,
  category: entry.category,
  assetTypes: entry.assetTypes ?? [],
  isPending: entry.isPending,
});

interface Plan {
  create: DictionaryDraft[];
  supersede: Array<{ entry: FailureDictionaryEntry; draft: DictionaryDraft }>;
  unchanged: number;
}

/**
 * Bulk upsert of the plant's failure dictionary (SME D11: the maintenance code export and its crosswalk):
 * JSON rows or CSV, all or nothing. A new kind + class + code is created; a changed one gets a new version
 * from `effectiveFrom` (the old version ends there); an equal one is left alone. Entries missing from the
 * document are kept — an import never deletes. Serialised per plant by an advisory lock.
 */
@Injectable()
export class FailureDictionaryImportV2Service {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async import(
    context: RequestContext,
    input: FailureDictionaryImportDto,
  ): Promise<FailureDictionaryImportV2View> {
    const stamp = writerStamp(context);
    const from = input.effectiveFrom
      ? new Date(input.effectiveFrom)
      : new Date();
    return this.manager.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `failure_dictionary:${stamp.tenantId}`,
      ]);
      const current = await openEntries(manager, stamp.tenantId);
      const classes = new Set(
        current
          .filter((e) => e.entryKind === 'equipment_class')
          .map((e) => e.code),
      );
      const parsed = parseDictionaryImport(input, classes);
      if (parsed.errors.length > 0) throw importInvalid(parsed.errors);
      const plan = planOf(parsed.rows, current);
      if (!input.dryRun) await apply(manager, stamp, plan, from);
      return {
        total: parsed.total,
        created: plan.create.length,
        superseded: plan.supersede.length,
        unchanged: plan.unchanged,
        dryRun: input.dryRun ?? false,
      };
    });
  }
}

function planOf(
  rows: readonly DictionaryDraft[],
  current: readonly FailureDictionaryEntry[],
): Plan {
  const byKey = new Map(current.map((e) => [draftKey(draftOf(e)), e]));
  const plan: Plan = { create: [], supersede: [], unchanged: 0 };
  for (const draft of rows) {
    const entry = byKey.get(draftKey(draft));
    if (!entry) plan.create.push(draft);
    else if (sameContent(draftOf(entry), draft)) plan.unchanged++;
    else plan.supersede.push({ entry, draft });
  }
  return plan;
}

const contentColumns = (
  stamp: WriterStamp,
  draft: DictionaryDraft,
): Partial<FailureDictionaryEntry> => ({
  name: draft.name,
  description: draft.description,
  category: draft.category,
  assetTypes: draft.assetTypes,
  isPending: draft.isPending,
  updatedBy: stamp.actorId,
});

const rowOf = (
  stamp: WriterStamp,
  draft: DictionaryDraft,
  from: Date,
): Partial<FailureDictionaryEntry> => ({
  ...contentColumns(stamp, draft),
  tenantId: stamp.tenantId,
  entryKind: draft.kind,
  equipmentClass: draft.equipmentClass,
  code: draft.code,
  effectiveFrom: from,
  effectiveTo: null,
  createdBy: stamp.actorId,
});

/** An entry that started at or after `from` is corrected in place; an older one ends at `from`. */
async function apply(
  manager: EntityManager,
  stamp: WriterStamp,
  plan: Plan,
  from: Date,
): Promise<void> {
  const repository = manager.getRepository(FailureDictionaryEntry);
  const inserts = plan.create.map((draft) => rowOf(stamp, draft, from));
  for (const { entry, draft } of plan.supersede) {
    if (entry.effectiveFrom >= from) {
      await repository.update(entry.id, contentColumns(stamp, draft));
      continue;
    }
    await repository.update(entry.id, {
      effectiveTo: from,
      updatedBy: stamp.actorId,
    });
    inserts.push(rowOf(stamp, draft, from));
  }
  for (let i = 0; i < inserts.length; i += 500) {
    await repository.insert(inserts.slice(i, i + 500));
  }
}
