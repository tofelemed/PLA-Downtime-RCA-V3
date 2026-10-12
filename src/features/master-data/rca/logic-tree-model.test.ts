import { describe, expect, it } from 'vitest';
import type { LogicTreeNode } from '../api/master-data-types';
import { addNode, flatten, moveSibling, moveUnder, removeNode, sanitizeTree, updateNode } from './logic-tree-model';

const node = (id: string, children: LogicTreeNode[] = []): LogicTreeNode => ({ id, name: id, code: id.toUpperCase(), category: 'Equipment', children });
const ids = (tree: LogicTreeNode[]) => flatten(tree).map((entry) => `${'-'.repeat(entry.depth)}${entry.node.id}`);

describe('logic tree model', () => {
  const tree = [node('a', [node('a1'), node('a2')]), node('b')];

  it('adds, updates and removes nodes with their subtree', () => {
    expect(ids(addNode(tree, 'a1', node('x')))).toEqual(['a', '-a1', '--x', '-a2', 'b']);
    expect(ids(addNode(tree, null, node('c')))).toEqual(['a', '-a1', '-a2', 'b', 'c']);
    expect(updateNode(tree, 'a2', { name: 'Renamed', code: 'R', category: 'Method', description: '' })[0].children?.[1]).toMatchObject({ name: 'Renamed', category: 'Method' });
    expect(ids(removeNode(tree, 'a'))).toEqual(['b']);
  });

  it('reorders siblings and moves under another node, never into its own subtree', () => {
    expect(ids(moveSibling(tree, 'a2', -1))).toEqual(['a', '-a2', '-a1', 'b']);
    expect(ids(moveSibling(tree, 'a', -1))).toEqual(ids(tree));
    expect(ids(moveUnder(tree, 'b', 'a1'))).toEqual(['a', '-a1', '--b', '-a2']);
    expect(ids(moveUnder(tree, 'a', 'a1'))).toEqual(ids(tree));
    expect(ids(moveUnder(tree, 'a1', null))).toEqual(['a', '-a2', 'b', 'a1']);
  });

  it('keeps only valid nodes of an imported tree', () => {
    const imported = sanitizeTree([{ id: 'n', name: 'Seal', code: 'S', category: 'Luck', extra: 1, children: [{ name: '' }] }, 'x']);
    expect(imported).toEqual([{ id: 'n', name: 'Seal', code: 'S', category: 'Equipment', children: [] }]);
  });
});
