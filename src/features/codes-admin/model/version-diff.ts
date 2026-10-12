import type { CodeVersionView } from '@/api/v2/types/codes-admin';
import { humanize } from '@/features/ux-kit/labels/humanize';

type Snapshot = CodeVersionView['snapshot'];
type SnapshotValue = Snapshot[string];

export interface SnapshotChange {
  key: string;
  before: SnapshotValue | undefined;
  after: SnapshotValue | undefined;
}

export interface VersionEntry {
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string | null;
  /** fields that differ from the previous version (all fields for version 1) */
  changes: SnapshotChange[];
}

/** Bookkeeping keys that change with every version and say nothing about the content. */
const IGNORED = new Set(['version', 'effectiveFrom', 'effectiveTo', 'path', 'level', 'library', 'id', 'tenantId', 'rowVersion', 'createdAt', 'updatedAt', 'createdBy']);

const LABELS: Readonly<Record<string, string>> = {
  name: 'Name',
  description: 'Description',
  parentId: 'Parent',
  category: 'Category',
  'defaults.oeeComponent': 'Default OEE component',
  'defaults.scheduleClass': 'Default schedule class',
  'defaults.impactCodeId': 'Default impact code',
  costPerHour: 'Cost per hour',
  reportOrder: 'Report order',
  groupKind: 'Level',
  code: 'Code',
};

export const snapshotLabel = (key: string): string => LABELS[key] ?? humanize(key);

/** Field-by-field difference of two snapshots (presentation only; versions are stored by the server). */
export function snapshotChanges(previous: Snapshot | null, next: Snapshot): SnapshotChange[] {
  const keys = new Set([...Object.keys(previous ?? {}), ...Object.keys(next)]);
  return [...keys]
    .filter((key) => !IGNORED.has(key))
    .filter((key) => (previous ? previous[key] !== next[key] : next[key] !== null && next[key] !== undefined))
    .sort()
    .map((key) => ({ key, before: previous?.[key], after: next[key] }));
}

/** Versions newest first, each with what changed against the one before it. */
export function versionTimeline(versions: readonly CodeVersionView[]): VersionEntry[] {
  const ordered = [...versions].sort((a, b) => a.version - b.version);
  return ordered
    .map((entry, index) => ({
      version: entry.version,
      effectiveFrom: entry.effectiveFrom,
      effectiveTo: entry.effectiveTo,
      createdBy: entry.createdBy,
      changes: snapshotChanges(index === 0 ? null : ordered[index - 1].snapshot, entry.snapshot),
    }))
    .reverse();
}
