import { describe, expect, it } from 'vitest';
import type { CodeView } from '@/api/v2/types/flags';
import { drillCrumbs, subtreeIds } from './reason-drill';

const code = (id: string, parentId: string | null, path: string, active = true) =>
  ({
    id,
    code: id.toUpperCase(),
    name: `Reason ${id}`,
    parentId,
    path,
    active,
  }) as CodeView;

const library = [code('m', null, 'm'), code('p', 'm', 'm/p'), code('old', 'm', 'm/old', false)];

describe('reason drill over the whole library (FE-05)', () => {
  it('lists the events of retired child codes under a drilled group', () => {
    expect(subtreeIds('m', library)).toEqual(['m', 'old', 'p']);
  });

  it('names a retired code on the breadcrumb, marked', () => {
    expect(drillCrumbs(['m', 'old', 'gone'], library).map((c) => c.label)).toEqual([
      'M · Reason m',
      'OLD · Reason old (retired)',
      'Unknown reason',
    ]);
  });
});
