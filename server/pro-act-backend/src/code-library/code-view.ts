import { toDecimalString } from '../v2/common/decimal-string.transformer';
import { CodeLibraryKind } from './code-library-kind';
import { CodeRow } from './code-library.descriptors';
import { isEffective } from './code-matching';
import { CodeSnapshot } from './code-version.entity';
import { pathOf } from './code-tree';

/** v2 view of a code of any library (library-specific fields only where the library has them). */
export interface CodeV2View {
  id: string;
  library: CodeLibraryKind;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  path: string;
  level: number;
  version: number;
  /** = version; the ETag / If-Match value */
  rowVersion: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  /** effective now and not deactivated */
  active: boolean;
  category?: string | null;
  groupKind?: string;
  reportOrder?: number;
  defaults?: {
    oeeComponent: string | null;
    scheduleClass: string | null;
    impactCodeId: string | null;
  };
  costPerHour?: string | null;
}

export function toCodeView(
  library: CodeLibraryKind,
  row: CodeRow,
  now: Date = new Date(),
): CodeV2View {
  const lifetime = {
    effectiveFrom: row.effectiveFrom ?? null,
    effectiveTo: row.effectiveTo ?? null,
  };
  return {
    id: row.id,
    library,
    code: row.code,
    name: row.name,
    description: row.description ?? null,
    parentId: row.parentId ?? null,
    path: pathOf(row),
    level: row.level ?? 0,
    version: row.version,
    rowVersion: row.version,
    effectiveFrom: lifetime.effectiveFrom?.toISOString() ?? null,
    effectiveTo: lifetime.effectiveTo?.toISOString() ?? null,
    active: row.isActive && isEffective(lifetime, now),
    ...libraryFields(library, row),
  };
}

function libraryFields(
  library: CodeLibraryKind,
  row: CodeRow,
): Partial<CodeV2View> {
  switch (library) {
    case 'reason':
      return {
        category: row.category ?? null,
        defaults: {
          oeeComponent: row.defaultOeeComponent ?? null,
          scheduleClass: row.defaultScheduleClass ?? null,
          impactCodeId: row.defaultImpactCodeId ?? null,
        },
      };
    case 'impact':
      return {
        category: row.category ?? null,
        costPerHour: toDecimalString(row.costPerHour ?? null),
      };
    case 'oee':
      return { category: row.category ?? null };
    case 'failure':
      return { groupKind: row.groupKind };
    case 'loss_category':
      return { reportOrder: row.reportOrder ?? 0 };
  }
}

/** Flat snapshot of a view for `code_versions.snapshot`. */
export function codeSnapshot(view: CodeV2View): CodeSnapshot {
  const snapshot: CodeSnapshot = {};
  for (const [key, value] of Object.entries(view)) {
    if (key === 'rowVersion' || key === 'active') continue;
    if (value !== null && typeof value === 'object') {
      for (const [inner, entry] of Object.entries(value as object)) {
        snapshot[`${key}.${inner}`] = entry as string | null;
      }
      continue;
    }
    snapshot[key] = value as string | number | boolean | null;
  }
  return snapshot;
}
