import { VersionRef } from './profile.types';
import {
  covers,
  overlaps,
  planApproval,
  segmentsByVersion,
  versionAt,
} from './version-window';

const t = (time: string) => new Date(`2026-10-09T${time}:00.000Z`);
const ref = (
  id: string,
  version: number,
  from: string,
  to: string | null,
): VersionRef => ({ id, version, from: t(from), to: to ? t(to) : null });

describe('effective-dated versions (plan 2.2)', () => {
  const v1 = ref('v1', 1, '00:00', '10:30');
  const v2 = ref('v2', 2, '10:30', null);

  it('treats validity as half-open: the boundary instant belongs to the later version only', () => {
    expect(covers(v1, t('10:30'))).toBe(false);
    expect(covers(v2, t('10:30'))).toBe(true);
    expect(overlaps(v1, v2)).toBe(false);
    expect(overlaps(v1, ref('x', 3, '10:29', '10:31'))).toBe(true);
  });

  it('resolves the version in force (T30 input: 100 t/h until 10:30, 120 t/h after)', () => {
    expect(versionAt([v1, v2], t('10:15'))?.id).toBe('v1');
    expect(versionAt([v1, v2], t('10:45'))?.id).toBe('v2');
    expect(versionAt([v2], t('09:00'))).toBeNull();
  });

  it('refuses any overlap without supersede, naming the conflicting versions', () => {
    const open = ref('a', 1, '00:00', null);
    const plan = planApproval({ from: t('10:30'), to: null }, [open], false);
    expect(plan).toEqual({ supersede: null, conflicts: [open] });
  });

  it('supersedes the predecessor exactly at the new from', () => {
    const open = ref('a', 1, '00:00', null);
    const plan = planApproval({ from: t('10:30'), to: null }, [open], true);
    expect(plan.conflicts).toEqual([]);
    expect(plan.supersede).toEqual({
      id: 'a',
      version: 1,
      effectiveTo: t('10:30'),
    });
  });

  it('never supersedes a version starting at/after the candidate or outliving a bounded candidate', () => {
    const later = ref('b', 1, '11:00', null);
    expect(
      planApproval({ from: t('10:30'), to: null }, [later], true).conflicts,
    ).toEqual([later]);
    const same = ref('c', 1, '10:30', null);
    expect(
      planApproval({ from: t('10:30'), to: null }, [same], true).conflicts,
    ).toEqual([same]);
    const open = ref('d', 1, '00:00', null);
    expect(
      planApproval({ from: t('10:30'), to: t('12:00') }, [open], true),
    ).toEqual({ supersede: null, conflicts: [open] });
  });

  it('splits a window at version boundaries and reports gaps', () => {
    const segments = segmentsByVersion([v1, v2], {
      from: t('10:00'),
      to: t('11:00'),
    });
    expect(segments.map((s) => [s.from, s.to, s.version?.id])).toEqual([
      [t('10:00'), t('10:30'), 'v1'],
      [t('10:30'), t('11:00'), 'v2'],
    ]);
    const gap = segmentsByVersion([ref('g', 1, '10:20', '10:40')], {
      from: t('10:00'),
      to: t('11:00'),
    });
    expect(gap.map((s) => s.version?.id ?? null)).toEqual([null, 'g', null]);
    expect(
      segmentsByVersion([v1], { from: t('11:00'), to: t('11:00') }),
    ).toEqual([]);
  });
});
