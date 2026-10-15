import { beforeEach, describe, expect, it } from 'vitest';
import { emptyCaseForm } from '../../model/rca-form';
import { MAX_DEFINITION_DRAFTS, retainedDefinitionDrafts as store } from './retained-definition-drafts';

const draft = { form: { ...emptyCaseForm('unit100'), title: 'Draft investigation' }, rowVersion: 4, timezone: 'Asia/Tehran' };
describe('retained RCA definition isolation and bounds', () => {
  beforeEach(() => { store.setOwner(null); store.setOwner('user:plant:grants'); });
  it('retains original version/date basis and isolates cases and owners', () => {
    store.write('user:plant:grants', 'case1', draft);
    expect(store.read('user:plant:grants', 'case1')).toEqual(draft);
    expect(store.read('other', 'case1')).toBeNull();
    expect(store.read('user:plant:grants', 'case2')).toBeNull();
  });
  it.each(['another-user:plant:grants', 'user:another-plant:grants', 'user:plant:reduced', null])('clears pending drafts after scope change: %s', scope => {
    store.write('user:plant:grants', 'case1', draft); store.setOwner(scope);
    expect(store.hasPending()).toBe(false);
    store.write('user:plant:grants', 'case1', draft);
    expect(store.hasPending()).toBe(false);
  });
  it('refuses new entries at capacity without evicting any edits, then permits explicit cleanup', () => {
    for (let i = 0; i < MAX_DEFINITION_DRAFTS; i++) store.write('user:plant:grants', `case${i}`, draft);
    expect(store.atCapacity('user:plant:grants', 'new')).toBe(true);
    store.write('user:plant:grants', 'new', draft);
    expect(store.list('user:plant:grants')).toHaveLength(MAX_DEFINITION_DRAFTS);
    expect(store.read('user:plant:grants', 'case0')).toEqual(draft);
    store.clear('user:plant:grants', 'case0');
    expect(store.atCapacity('user:plant:grants', 'new')).toBe(false);
  });
});
