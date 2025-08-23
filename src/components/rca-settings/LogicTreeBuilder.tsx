import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, FolderTree, Eye, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, useDroppable, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface LogicTreeNode {
  id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
  children?: LogicTreeNode[];
  note?: string;
  finding?: boolean;
}

const categoryColors: Record<string, string> = {
  Equipment: 'bg-blue-100 text-blue-800',
  Process: 'bg-green-100 text-green-800',
  Material: 'bg-yellow-100 text-yellow-800',
  Personnel: 'bg-purple-100 text-purple-800',
  Environment: 'bg-cyan-100 text-cyan-800',
  Method: 'bg-pink-100 text-pink-800',
};

interface LogicTreeBuilderProps {
  treeData: LogicTreeNode[];
  onTreeChange: (tree: LogicTreeNode[]) => void;
  editable?: boolean;
}

const LogicTreeBuilder: React.FC<LogicTreeBuilderProps> = ({ treeData, onTreeChange, editable }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showOverlay, setShowOverlay] = useState<'add' | 'edit' | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingNode, setEditingNode] = useState<LogicTreeNode | null>(null);
  const [parentForAdd, setParentForAdd] = useState<LogicTreeNode | null>(null);
  const [form, setForm] = useState({ name: '', code: '', category: 'Equipment', description: '' });
  const [viewNode, setViewNode] = useState<LogicTreeNode | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);

  const handleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openAddDialog = (parent: LogicTreeNode | null = null) => {
    setDialogMode('add');
    setEditingNode(null);
    setParentForAdd(parent);
    setForm({ name: '', code: '', category: 'Equipment', description: '' });
    setShowOverlay('add');
  };

  const openEditDialog = (node: LogicTreeNode) => {
    setDialogMode('edit');
    setEditingNode(node);
    setParentForAdd(null);
    setForm({ name: node.name, code: node.code, category: node.category, description: node.description || '' });
    setShowOverlay('edit');
  };

  const handleDelete = (node: LogicTreeNode, parent: LogicTreeNode[] | null) => {
    if (!window.confirm(`Delete "${node.name}" and all its children?`)) return;
    // Use the same logic as removeNodeById for immutability
    function recur(arr: LogicTreeNode[]): LogicTreeNode[] {
      return arr.reduce<LogicTreeNode[]>((acc, n) => {
        if (n.id === node.id) {
          return acc;
        }
        let newChildren = n.children ? recur(n.children) : undefined;
        if (n.children && newChildren !== n.children) {
          acc.push({ ...n, children: newChildren });
        } else if (n.children) {
          acc.push({ ...n });
        } else {
          acc.push(n);
        }
        return acc;
      }, []);
    }
    onTreeChange(recur(treeData));
  };

  const handleOverlaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dialogMode === 'add') {
      const newNode: LogicTreeNode = {
        id: Math.random().toString(36).substr(2, 9),
        name: form.name,
        code: form.code,
        category: form.category,
        description: form.description,
        children: [],
      };
      if (parentForAdd) {
        const addChild = (nodes: LogicTreeNode[]): LogicTreeNode[] =>
          nodes.map(n =>
            n.id === parentForAdd.id
              ? { ...n, children: [...(n.children || []), newNode] }
              : { ...n, children: n.children ? addChild(n.children) : [] }
          );
        onTreeChange(addChild(treeData));
      } else {
        onTreeChange([...treeData, newNode]);
      }
    } else if (editingNode) {
      const updateNode = (nodes: LogicTreeNode[]): LogicTreeNode[] =>
        nodes.map(n =>
          n.id === editingNode.id
            ? { ...n, name: form.name, code: form.code, category: form.category, description: form.description }
            : { ...n, children: n.children ? updateNode(n.children) : [] }
        );
      onTreeChange(updateNode(treeData));
    }
    setShowOverlay(null);
  };

  function DraggableTreeNode({ id, children }: { id: string; children: (dragListeners: any) => React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    return (
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
          background: isDragging ? '#f3f4f6' : undefined,
        }}
        {...attributes}
      >
        {children(listeners)}
      </div>
    );
  }

  function findNodeAndParent(nodes: LogicTreeNode[], id: string, parent: LogicTreeNode[] | null = null): { node: LogicTreeNode | null, parent: LogicTreeNode[] | null } {
    for (const n of nodes) {
      if (n.id === id) return { node: n, parent };
      if (n.children) {
        const res = findNodeAndParent(n.children, id, n.children);
        if (res.node) return res;
      }
    }
    return { node: null, parent: null };
  }

  function removeNodeById(nodes: LogicTreeNode[], id: string): [LogicTreeNode[], LogicTreeNode | null] {
    let removed: LogicTreeNode | null = null;
    function recur(arr: LogicTreeNode[]): LogicTreeNode[] {
      return arr.reduce<LogicTreeNode[]>((acc, n) => {
        if (n.id === id) {
          removed = n;
          return acc;
        }
        let newChildren = n.children ? recur(n.children) : undefined;
        // Only create a new object if children changed
        if (n.children && newChildren !== n.children) {
          acc.push({ ...n, children: newChildren });
        } else if (n.children) {
          acc.push({ ...n });
        } else {
          acc.push(n);
        }
        return acc;
      }, []);
    }
    return [recur(nodes), removed];
  }

  function isDescendant(sourceId: string, target: LogicTreeNode): boolean {
    if (!target.children) return false;
    for (const child of target.children) {
      if (child.id === sourceId || isDescendant(sourceId, child)) return true;
    }
    return false;
  }

  // Helper: flatten tree to array of all node IDs
  function flattenTreeIds(nodes: LogicTreeNode[]): string[] {
    let ids: string[] = [];
    for (const n of nodes) {
      ids.push(n.id);
      if (n.children) ids = ids.concat(flattenTreeIds(n.children));
    }
    return ids;
  }

  // Helper: find parent array and index of a node by id
  function findParentArrayAndIndex(nodes: LogicTreeNode[], id: string, parentArr: LogicTreeNode[] | null = null): { parentArr: LogicTreeNode[] | null, index: number } | null {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) return { parentArr, index: i };
      if (nodes[i].children) {
        const res = findParentArrayAndIndex(nodes[i].children, id, nodes[i].children);
        if (res) return res;
      }
    }
    return null;
  }

  // Top-level DndContext and SortableContext
  const allNodeIds = flattenTreeIds(treeData);

  const renderNodeList = (nodes: LogicTreeNode[], depth = 0, parentArray: LogicTreeNode[] | null = null) => {
    if (!nodes.length) return null;
    return (
      <>
        {nodes.map(node => (
          <DraggableTreeNode key={node.id} id={node.id}>
            {(dragListeners) => renderNode(node, depth, parentArray || treeData, dragListeners, overId === node.id, activeId === node.id)}
          </DraggableTreeNode>
        ))}
      </>
    );
  };

  const renderNode = (node: LogicTreeNode, depth = 0, parentArray: LogicTreeNode[] | null = null, dragListeners: any = {}, isOver = false, isActive = false) => (
    <div key={node.id} className="ml-1 mt-1">
      <div
        className={`flex items-center px-1 py-0.5 mb-0.5 border-l-2 bg-white hover:bg-gray-50 transition-colors ${isOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''} ${isActive ? 'opacity-60' : ''}`}
        style={{ borderLeftColor: '#3B82F6', marginLeft: depth * 12, minHeight: 28 }}
      >
        <span className="cursor-grab mr-1 flex items-center" tabIndex={-1} aria-label="Drag handle" {...dragListeners}>
          <GripVertical className="w-3 h-3 text-gray-400" />
        </span>
        {node.children && node.children.length > 0 && (
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); handleExpand(String(node.id)); }} className="focus:outline-none p-0 mr-1">
            {expanded.has(String(node.id)) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
        <FolderTree className="w-3 h-3 text-blue-500 mr-1" />
        <span className="font-medium text-xs text-gray-800 truncate max-w-[100px]">{node.name}</span>
        <span className="text-[10px] text-gray-400 ml-1">{node.code}</span>
        {editable && (
          <div className="flex gap-0.5 ml-auto">
            <Button type="button" size="icon" variant="ghost" title="View" className="h-5 w-5 p-0" onClick={e => { e.preventDefault(); e.stopPropagation(); setViewNode(node); }}><Eye className="w-3 h-3" /></Button>
            <Button type="button" size="icon" variant="ghost" title="Add Child" className="h-5 w-5 p-0" onClick={e => { e.preventDefault(); e.stopPropagation(); openAddDialog(node); }}><Plus className="w-3 h-3 text-green-600" /></Button>
            <Button type="button" size="icon" variant="ghost" title="Edit" className="h-5 w-5 p-0" onClick={e => { e.preventDefault(); e.stopPropagation(); openEditDialog(node); }}><Edit className="w-3 h-3" /></Button>
            <Button type="button" size="icon" variant="ghost" title="Delete" className="h-5 w-5 p-0" onClick={e => { e.preventDefault(); e.stopPropagation(); handleDelete(node, parentArray || treeData); }}><Trash2 className="w-3 h-3 text-red-500" /></Button>
          </div>
        )}
      </div>
      {expanded.has(String(node.id)) && node.children && node.children.length > 0 && (
        <div className="ml-2">
          {renderNodeList(node.children, depth + 1, node.children)}
        </div>
      )}
    </div>
  );

  // Root drop zone for moving nodes to root
  const RootDropZone = () => (
    <div
      onDragOver={e => { e.preventDefault(); setRootDropActive(true); }}
      onDragLeave={e => { e.preventDefault(); setRootDropActive(false); }}
      onDrop={e => { setRootDropActive(false); }}
      className={`h-8 flex items-center justify-center border-2 border-dashed rounded mb-2 transition-colors ${rootDropActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
      style={{ minHeight: 28 }}
    >
      <span className="text-xs text-gray-400">Drop here to make root node</span>
    </div>
  );

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <FolderTree className="h-5 w-5 text-blue-600" />
        <CardTitle className="text-lg">Logic Tree</CardTitle>
        {editable && (
          <Button type="button" size="sm" className="ml-auto" onClick={() => openAddDialog(null)}>
            <Plus className="w-4 h-4 mr-1" /> Add Top-Level Node
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {activeId && <RootDropZone />}
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={event => setActiveId(event.active.id as string)}
          onDragOver={event => {
            setOverId(event.over?.id as string || null);
            // Highlight root drop zone if not over any node
            if (!event.over) setRootDropActive(true);
            else setRootDropActive(false);
          }}
          onDragEnd={event => {
            const { active, over } = event;
            setActiveId(null);
            setOverId(null);
            setRootDropActive(false);
            if (!active.id) return;

            // If dropped on root drop zone (no over target), move to root
            if (!over) {
              // Remove from wherever it is
              const [treeWithoutActive, draggedNode] = removeNodeById(treeData, active.id as string);
              if (!draggedNode) return;
              // treeWithoutActive is the updated tree, but we want the new root array
              // So flatten the top-level nodes (root array) after removal
              // If treeWithoutActive is an array of root nodes, just add draggedNode to it
              // But if it's a single object (shouldn't be), wrap in array
              let newRoot: LogicTreeNode[] = Array.isArray(treeWithoutActive) ? treeWithoutActive : [treeWithoutActive];
              // Remove any undefined/null
              newRoot = newRoot.filter(Boolean);
              // Add the dragged node to the end of the root array
              onTreeChange([...newRoot, draggedNode]);
              return;
            }

            if (active.id === over.id) return;

            // Remove node from its current location
            const [treeWithoutActive, draggedNode] = removeNodeById(treeData, active.id as string);
            if (!draggedNode) return;

            // Find parent array and index for over.id
            const overInfo = findParentArrayAndIndex(treeData, over.id as string);
            if (!overInfo) return;
            const { parentArr, index } = overInfo;

            // If over a node, check if we want to add as child or reorder among siblings
            const { node: targetNode } = findNodeAndParent(treeWithoutActive, over.id as string);
            if (targetNode && !isDescendant(draggedNode.id, targetNode) && draggedNode.id !== targetNode.id) {
              // Add as child
              const addAsChild = (nodes: LogicTreeNode[]): LogicTreeNode[] =>
                nodes.map(n =>
                  n.id === targetNode.id
                    ? { ...n, children: [...(n.children || []), draggedNode] }
                    : { ...n, children: n.children ? addAsChild(n.children) : [] }
                );
              onTreeChange(addAsChild(treeWithoutActive));
            } else if (parentArr) {
              // Reorder among siblings (including children)
              const fromInfo = findParentArrayAndIndex(treeData, active.id as string);
              if (!fromInfo) return;
              const fromArr = fromInfo.parentArr || treeData;
              const fromIdx = fromInfo.index;
              const toIdx = index;
              if (fromArr === parentArr) {
                // Same parent, reorder
                const newArr = arrayMove([...parentArr], fromIdx, toIdx);
                // Recursively update tree
                const updateTree = (nodes: LogicTreeNode[]): LogicTreeNode[] =>
                  nodes.map(n =>
                    n.children === parentArr ? { ...n, children: newArr } : { ...n, children: n.children ? updateTree(n.children) : [] }
                  );
                if (parentArr === treeData) {
                  onTreeChange(newArr);
                } else {
                  onTreeChange(updateTree(treeData));
                }
              } else {
                // Move to different parent at specific position
                const newArr = [...parentArr];
                newArr.splice(toIdx, 0, draggedNode);
                // Recursively update tree
                const updateTree = (nodes: LogicTreeNode[]): LogicTreeNode[] =>
                  nodes.map(n =>
                    n.children === parentArr ? { ...n, children: newArr } : { ...n, children: n.children ? updateTree(n.children) : [] }
                  );
                onTreeChange(updateTree(treeData));
              }
            } else {
              // fallback: reorder at root
              const idxA = treeData.findIndex(n => n.id === active.id);
              const idxB = treeData.findIndex(n => n.id === over?.id);
              if (idxA !== -1 && idxB !== -1) {
                const newNodes = arrayMove(treeData, idxA, idxB);
                onTreeChange(newNodes);
              }
            }
          }}
        >
          <SortableContext items={allNodeIds} strategy={verticalListSortingStrategy}>
            {renderNodeList(treeData, 0, null)}
          </SortableContext>
        </DndContext>
      </CardContent>
      {showOverlay && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-xs relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-700" onClick={() => setShowOverlay(null)}>&times;</button>
            <div className="font-semibold text-lg mb-2">{dialogMode === 'add' ? (parentForAdd ? 'Add Child Node' : 'Add Top-Level Node') : 'Edit Node'}</div>
            <form onSubmit={handleOverlaySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Name</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Code</label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Category</label>
                <select className="w-full border rounded px-2 py-1" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="Equipment">Equipment</option>
                  <option value="Process">Process</option>
                  <option value="Material">Material</option>
                  <option value="Personnel">Personnel</option>
                  <option value="Environment">Environment</option>
                  <option value="Method">Method</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowOverlay(null)} size="sm">Cancel</Button>
                <Button type="submit" size="sm">{dialogMode === 'add' ? 'Add' : 'Update'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {viewNode && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs relative border border-blue-100 flex flex-col items-center animate-fade-in">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-blue-600 text-xl font-bold" onClick={() => setViewNode(null)} aria-label="Close">
              &times;
            </button>
            <div className="flex flex-col items-center w-full mb-2">
              <FolderTree className="w-8 h-8 text-blue-500 mb-1" />
              <div className="text-lg font-bold text-blue-700 mb-0.5 text-center">{viewNode.name}</div>
              <div className="text-xs text-gray-400 mb-2 tracking-wide">Node Details</div>
            </div>
            <div className="w-full space-y-3">
              {/* Parent info */}
              {(() => {
                const parentInfo = findNodeAndParent(treeData, viewNode.id);
                const parentNode = parentInfo.parent && parentInfo.parent !== treeData ?
                  treeData.flatMap(n => [n, ...(n.children || [])]).find(n => n.children && n.children.some(c => c.id === viewNode.id)) : null;
                return (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Parent</span>
                    <span className="text-xs text-blue-600 font-medium min-h-[1.2em]">{parentNode ? parentNode.name : <span className="text-gray-400">(root)</span>}</span>
                  </div>
                );
              })()}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Code</span>
                <span className="text-base font-mono text-gray-800 bg-gray-50 rounded px-2 py-0.5 border border-gray-100">{viewNode.code}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Category</span>
                <span className="inline-block"><Badge className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">{viewNode.category}</Badge></span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Description</span>
                <span className="text-gray-700 whitespace-pre-line min-h-[1.2em] text-xs">{viewNode.description || <span className="text-gray-400">(none)</span>}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default LogicTreeBuilder; 