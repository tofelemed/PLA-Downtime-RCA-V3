import React, { useEffect, useState } from 'react';
import { masterDataService, ReasonCode } from '../../services/MasterDataService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TreeNode extends ReasonCode {
  children?: TreeNode[];
}

const ReasonCodeLibraryTree: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [codes, setCodes] = useState<ReasonCode[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingNode, setEditingNode] = useState<TreeNode | null>(null);
  const [parentForAdd, setParentForAdd] = useState<TreeNode | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  useEffect(() => {
    loadCodes();
  }, [session]);

  const loadCodes = async () => {
    if (!session) return;
    try {
      const all = await masterDataService.getReasonCodes(
        session.tenant?.id ? { tenantId: session.tenant.id } : undefined,
      );
      setCodes(all);
      setTree(buildTree(all));
    } catch (error) {
      console.error('Failed to load reason codes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reason codes',
        variant: 'destructive',
      });
    }
  };

  const buildTree = (flat: ReasonCode[]): TreeNode[] => {
    const map = new Map<string, TreeNode>();
    flat.forEach(code => map.set(String(code.id), { ...code, children: [] }));
    const roots: TreeNode[] = [];
    map.forEach(node => {
      if (node.parentId && map.has(String(node.parentId))) {
        map.get(String(node.parentId))!.children!.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const handleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openAddDialog = (parent: TreeNode | null = null) => {
    setDialogMode('add');
    setEditingNode(null);
    setParentForAdd(parent);
    setForm({ code: '', name: '', description: '' });
    setShowDialog(true);
  };

  const openEditDialog = (node: TreeNode) => {
    setDialogMode('edit');
    setEditingNode(node);
    setParentForAdd(null);
    setForm({ code: node.code, name: node.name, description: node.description || '' });
    setShowDialog(true);
  };

  const handleDelete = async (node: TreeNode) => {
    if (!window.confirm(`Delete "${node.name}" and all its children?`)) return;
    try {
      await masterDataService.deleteReasonCode(node.id);
      toast({ title: 'Deleted', description: 'Reason code deleted.' });
      loadCodes();
    } catch (error) {
      console.error('Failed to delete reason code:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete reason code',
        variant: 'destructive',
      });
    }
  };

  const handleDialogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.tenant?.id) {
      toast({
        title: 'Tenant required',
        description: 'Select a tenant before managing reason codes.',
        variant: 'destructive',
      });
      return;
    }
    try {
      if (dialogMode === 'add') {
        await masterDataService.createReasonCode({
          code: form.code,
          name: form.name,
          description: form.description,
          parentId: parentForAdd ? String(parentForAdd.id) : undefined,
          tenantId: session.tenant.id,
        });
        toast({ title: 'Added', description: 'Reason code added.' });
      } else if (editingNode) {
        await masterDataService.updateReasonCode(editingNode.id, {
          code: form.code,
          name: form.name,
          description: form.description,
        });
        toast({ title: 'Updated', description: 'Reason code updated.' });
      }
      setShowDialog(false);
      loadCodes();
    } catch (error) {
      console.error('Failed to save reason code:', error);
      toast({
        title: 'Error',
        description: 'Failed to save reason code',
        variant: 'destructive',
      });
    }
  };

  const renderTree = (nodes: TreeNode[], level = 0) => (
    <ul className={level === 0 ? 'pl-0' : 'pl-4 border-l border-gray-200'}>
      {nodes.map(node => (
        <li key={node.id} className="mb-1 relative group">
          <div className={`flex items-center gap-2 py-1 px-2 rounded transition-colors ${level === 0 ? 'bg-gradient-to-r from-blue-50/40 to-purple-50/40' : 'hover:bg-gray-50'} ${node.children && node.children.length > 0 ? 'font-semibold' : ''}`}
               style={{ marginLeft: level > 0 ? -1 : 0 }}>
            {node.children && node.children.length > 0 && (
              <button
                className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-blue-600 focus:outline-none mr-1"
                onClick={() => handleExpand(node.id)}
                title={expanded.has(node.id) ? 'Collapse' : 'Expand'}
                tabIndex={0}
                type="button"
              >
                {expanded.has(node.id) ? <span>&#9660;</span> : <span>&#9654;</span>}
              </button>
            )}
            <span className="text-xs text-gray-400 w-10 text-right mr-1 select-none">{node.code}</span>
            <span className="truncate font-medium text-gray-800 text-sm flex-1">{node.name}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="w-5 h-5 flex items-center justify-center text-green-600 hover:bg-green-50 rounded"
                onClick={() => openAddDialog(node)}
                title="Add Child"
                tabIndex={0}
                type="button"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                className="w-5 h-5 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded"
                onClick={() => openEditDialog(node)}
                title="Edit"
                tabIndex={0}
                type="button"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                className="w-5 h-5 flex items-center justify-center text-red-600 hover:bg-red-50 rounded"
                onClick={() => handleDelete(node)}
                title="Delete"
                tabIndex={0}
                type="button"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          {node.description && (
            <div className="ml-8 text-xs text-gray-500 italic pb-1">{node.description}</div>
          )}
          {node.children && node.children.length > 0 && expanded.has(node.id) && renderTree(node.children, level + 1)}
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <div className="flex items-center mb-4">
        <Button size="sm" onClick={() => openAddDialog(null)}><Plus className="w-4 h-4 mr-1" /> Add Top-Level Reason Code</Button>
      </div>
      {renderTree(tree)}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? 'Add Reason Code' : 'Edit Reason Code'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDialogSubmit} className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} required />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit">{dialogMode === 'add' ? 'Add' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReasonCodeLibraryTree; 