import { describe, expect, it } from 'vitest';
import { V2ApiError } from '@/api/v2/errors';
import type { CodeDetailView, CodeVersionView } from '@/api/v2/types/codes-admin';
import type { RulesSchemaView } from '@/api/v2/types/rules';
import { adminRefusalOf } from './model/admin-refusal';
import { canDrop, moveTargets, subtreeIds, treeRows } from './model/code-tree';
import { diffDefinitions } from './model/rule-describe';
import { definitionOf, draftOf, emptyDraft, errorsByRow } from './model/rule-form';
import { versionTimeline } from './model/version-diff';

const code = (id: string, parentId: string | null, extra: Partial<CodeDetailView> = {}): CodeDetailView => ({
  id, library: 'reason', code: id.toUpperCase(), name: id, description: null, parentId, path: id, level: 0, version: 1, rowVersion: 1,
  effectiveFrom: null, effectiveTo: null, active: true, ...extra,
});

const SCHEMA: RulesSchemaView = {
  grammarVersion: 1,
  schemaId: 'x',
  limits: { maxConditions: 20, maxDepth: 2, maxActions: 10, maxListValues: 50, maxGlobLength: 100, stepBudget: 10000 },
  operators: [
    { op: 'eq', label: 'equals', value: 'single' },
    { op: 'gte', label: 'at least', value: 'single' },
    { op: 'in', label: 'is one of', value: 'list' },
    { op: 'exists', label: 'is set', value: 'none' },
  ],
  fields: [
    { name: 'physicalType', label: 'Physical type', type: 'enum', values: ['downtime', 'slowdown'], operators: ['eq', 'in', 'exists'] },
    { name: 'durationSeconds', label: 'Duration (seconds)', type: 'number', operators: ['eq', 'gte', 'in', 'exists'] },
  ],
  kinds: [{ kind: 'coding_default', label: 'Coding default', sets: [{ field: 'scheduleClass', label: 'Schedule class', values: ['planned', 'unplanned'] }], flags: false, appliedBy: 'x' }],
};

describe('code tree editing (plan 3.8, T18 UI)', () => {
  const codes = [code('root', null), code('child', 'root'), code('leaf', 'child'), code('other', null), code('old', 'other', { active: false })];

  it('builds a 3-level tree depth first, sorted by code, collapsible', () => {
    expect(treeRows(codes).map((row) => [row.code.id, row.depth])).toEqual([
      ['other', 0], ['old', 1], ['root', 0], ['child', 1], ['leaf', 2],
    ]);
    expect(treeRows(codes, new Set(['root'])).map((row) => row.code.id)).toEqual(['other', 'old', 'root']);
  });

  it('never offers a move into the own subtree, onto a retired code or onto the current parent', () => {
    expect([...subtreeIds(codes, 'root')].sort()).toEqual(['child', 'leaf', 'root']);
    expect(moveTargets(codes, 'root').map((entry) => entry.id)).toEqual(['other']);
    expect(moveTargets(codes, 'leaf').map((entry) => entry.id)).toEqual(['other', 'root']);
    expect(canDrop(codes, 'root', 'leaf')).toBe(false);
    expect(canDrop(codes, 'leaf', 'other')).toBe(true);
    expect(canDrop(codes, 'leaf', null)).toBe(true);
    expect(canDrop(codes, 'root', null)).toBe(false);
  });

  it('keeps failure groups one level apart (class → problem → cause → remedy)', () => {
    const groups = [code('c', null, { groupKind: 'class' }), code('p', 'c', { groupKind: 'problem' }), code('x', null, { groupKind: 'class' }), code('k', 'p', { groupKind: 'cause' })];
    expect(moveTargets(groups, 'p').map((entry) => entry.id)).toEqual(['x']);
    expect(moveTargets(groups, 'k').map((entry) => entry.id)).toEqual([]);
    expect(canDrop(groups, 'p', null)).toBe(false);
  });
});

describe('version diff display', () => {
  const version = (n: number, snapshot: CodeVersionView['snapshot']): CodeVersionView => ({
    version: n, code: 'R', name: String(snapshot.name), parentId: null, snapshot, effectiveFrom: `2026-10-0${n}T00:00:00Z`, effectiveTo: null, createdBy: null,
  });

  it('shows what changed against the previous version, newest first, ignoring bookkeeping', () => {
    const timeline = versionTimeline([
      version(2, { name: 'Bearing', parentId: 'p1', version: 2, 'defaults.scheduleClass': 'unplanned' }),
      version(1, { name: 'Bearings', parentId: null, version: 1, 'defaults.scheduleClass': 'unplanned' }),
    ]);
    expect(timeline.map((entry) => entry.version)).toEqual([2, 1]);
    expect(timeline[0].changes).toEqual([
      { key: 'name', before: 'Bearings', after: 'Bearing' },
      { key: 'parentId', before: null, after: 'p1' },
    ]);
    expect(timeline[1].changes.map((change) => change.key)).toEqual(['defaults.scheduleClass', 'name']);
  });

  it('diffs rule definitions line by line', () => {
    const v1 = { when: { all: [{ field: 'durationSeconds', op: 'gte' as const, value: 3600 }] }, then: [{ set: 'scheduleClass', value: 'unplanned' }] };
    const v2 = { ...v1, then: [{ set: 'scheduleClass', value: 'planned' }] };
    expect(diffDefinitions(v1, v2, SCHEMA)).toEqual([
      { text: 'then set Schedule class = unplanned', change: 'removed' },
      { text: 'when all of: Duration (seconds) at least 3600', change: 'same' },
      { text: 'then set Schedule class = planned', change: 'added' },
    ]);
  });
});

describe('rule form (mirrors the API 422 fieldErrors)', () => {
  const draft = () => {
    const base = emptyDraft('coding_default');
    base.all = [
      { key: 'r1', field: 'physicalType', op: 'eq', value: 'downtime' },
      { key: 'r2', field: 'durationSeconds', op: 'gte', value: '3600' },
    ];
    base.any = [{ key: 'r3', field: 'durationSeconds', op: 'in', value: '60, 120,' }];
    base.actions = [{ key: 'a1', type: 'set', field: 'scheduleClass', value: 'unplanned' }];
    return base;
  };

  it('builds the JSON definition with typed values (numbers, lists), never code', () => {
    expect(definitionOf(draft(), SCHEMA)).toEqual({
      when: {
        all: [{ field: 'physicalType', op: 'eq', value: 'downtime' }, { field: 'durationSeconds', op: 'gte', value: 3600 }],
        any: [{ field: 'durationSeconds', op: 'in', value: [60, 120] }],
      },
      then: [{ set: 'scheduleClass', value: 'unplanned' }],
    });
    const text = JSON.stringify(definitionOf(draft(), SCHEMA));
    expect(text).not.toMatch(/function|=>|return/);
  });

  it('round-trips a stored definition and marks nested groups read-only', () => {
    const stored = definitionOf(draft(), SCHEMA);
    const again = draftOf({ kind: 'coding_default', name: 'n', description: '', priority: '100' }, stored);
    expect(definitionOf(again, SCHEMA)).toEqual(stored);
    expect(again.nested).toBe(false);
    const nested = draftOf({ kind: 'coding_default', name: 'n', description: '', priority: '1' }, { when: { all: [{ any: [{ field: 'source', op: 'exists' }] }] }, then: [] });
    expect(nested.nested).toBe(true);
  });

  it('puts each server field error on its row, the rest in general', () => {
    const errors = errorsByRow(draft(), [
      { field: 'definition.when.all.1.value', message: 'must be a number' },
      { field: 'definition.when.any.0.op', message: 'is not allowed' },
      { field: 'definition.then.0.value', message: 'must be one of: planned' },
      { field: 'definition.when', message: 'has 22 conditions' },
      { field: 'definition.when.all.9.op', message: 'unknown row' },
    ]);
    expect(errors.rows).toEqual({ r2: ['Enter a number.'], r3: ['Choose an operator that works with this field.'], a1: ['Choose one of the offered values.'] });
    expect(errors.general).toEqual(['Conditions: has 22 conditions.', 'Conditions: unknown row.']);
  });

  it('turns schema-validator wording into plain instructions and keeps untouched rows quiet (QA N1)', () => {
    const base = emptyDraft('coding_default');
    base.all = [{ key: 'e1', field: '', op: '', value: '' }, { key: 'e2', field: 'source', op: '', value: '' }];
    const raw = [
      { field: 'definition.when.all.0.field', message: 'must be equal to one of the allowed values: physicalType, scheduleClass' },
      { field: 'definition.when.all.1.op', message: 'must be equal to one of the allowed values: eq, neq, in, gt' },
      { field: 'definition.when.all.1.value', message: 'must NOT have fewer than 1 characters' },
    ];
    const quiet = errorsByRow(base, raw);
    expect(quiet.rows).toEqual({ e2: ['Choose an operator.', 'Enter a value.'] });
    const all = errorsByRow(base, raw, { revealUntouched: true });
    expect(all.rows.e1).toEqual(['Choose a field.']);
    expect(JSON.stringify(all)).not.toMatch(/allowed values|physicalType|neq|characters/);
  });
});

describe('admin refusals', () => {
  const refusal = (status: number, code: string, details?: Record<string, unknown>) =>
    adminRefusalOf(new V2ApiError(status, { code, message: code, correlationId: 'c', retryable: false, details }));

  it('names tenant-scope, separation of duties, role and conflict with reference counts', () => {
    expect(refusal(403, 'TENANT_SCOPE_REQUIRED')?.kind).toBe('tenant-scope');
    expect(refusal(403, 'SEPARATION_OF_DUTIES')?.kind).toBe('duties');
    expect(refusal(403, 'FORBIDDEN_ROLE')?.kind).toBe('role');
    expect(refusal(403, 'READ_ONLY_ROLE')).toMatchObject({ kind: 'role', title: 'Your role in this plant is read-only' });
    expect(refusal(412, 'STALE_REVISION')?.kind).toBe('stale');
    expect(refusal(422, 'CODE_CYCLE')?.kind).toBe('validation');
    expect(refusal(409, 'CODE_HAS_CHILDREN', { references: { activeChildren: 2, events: 5, mappingRules: 1 } })).toMatchObject({
      kind: 'state',
      status: 409,
      references: { activeChildren: 2, events: 5, mappingRules: 1 },
    });
  });
});
