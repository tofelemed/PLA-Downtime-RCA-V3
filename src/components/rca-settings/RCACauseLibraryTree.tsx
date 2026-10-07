import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, FolderTree } from 'lucide-react';
import { masterDataService, RCACauseCode } from '../../services/MasterDataService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../../contexts/AuthContext';

interface TreeNode extends RCACauseCode {
  children?: TreeNode[];
}

const categoryColors: Record<string, string> = {
  Equipment: 'bg-blue-100 text-blue-800',
  Process: 'bg-green-100 text-green-800',
  Material: 'bg-yellow-100 text-yellow-800',
  Personnel: 'bg-purple-100 text-purple-800',
  Environment: 'bg-cyan-100 text-cyan-800',
  Method: 'bg-pink-100 text-pink-800',
};

const RCACauseLibraryTree: React.FC = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const [codes, setCodes] = useState<RCACauseCode[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingNode, setEditingNode] = useState<TreeNode | null>(null);
  const [parentForAdd, setParentForAdd] = useState<TreeNode | null>(null);
  const [form, setForm] = useState({ name: '', code: '', category: 'Equipment', description: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCodes();
  }, [session]);

  const loadCodes = async () => {
    if (!session) return;
    try {
      const filters =
        session?.tenant?.id ? { tenantId: session.tenant.id } : undefined;
      const all = await masterDataService.getRCACauseCodes(filters);
      setCodes(all);
      setTree(buildTree(all));
    } catch (error) {
      console.error('Failed to load RCA cause codes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load RCA cause codes',
        variant: 'destructive',
      });
    }
  };

  const buildTree = (flat: RCACauseCode[]): TreeNode[] => {
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
    setForm({ name: '', code: '', category: 'Equipment', description: '' });
    setShowDialog(true);
  };

  const openEditDialog = (node: TreeNode) => {
    setDialogMode('edit');
    setEditingNode(node);
    setParentForAdd(null);
    setForm({ name: node.name, code: node.code, category: node.category, description: node.description || '' });
    setShowDialog(true);
  };

  const handleDelete = async (node: TreeNode) => {
    if (!window.confirm(`Delete "${node.name}" and all its children?`)) return;
    try {
      await masterDataService.deleteRCACauseCode(node.id);
      toast({ title: 'Deleted', description: 'Cause code deleted.' });
      loadCodes();
    } catch (error) {
      console.error('Failed to delete cause code:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete cause code',
        variant: 'destructive',
      });
    }
  };

  const handleDialogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.tenant?.id) {
      toast({
        title: 'Tenant required',
        description: 'Select a tenant before managing cause codes.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (dialogMode === 'add') {
        await masterDataService.createRCACauseCode({
          name: form.name,
          code: form.code,
          category: form.category as any,
          description: form.description,
          parentId: parentForAdd ? String(parentForAdd.id) : undefined,
          tenantId: session.tenant.id,
        });
        toast({ title: 'Added', description: 'Cause code added.' });
      } else if (editingNode) {
        await masterDataService.updateRCACauseCode(editingNode.id, {
          name: form.name,
          code: form.code,
          category: form.category as any,
          description: form.description,
        });
        toast({ title: 'Updated', description: 'Cause code updated.' });
      }
      setShowDialog(false);
      loadCodes();
    } catch (error) {
      console.error('Failed to save cause code:', error);
      toast({
        title: 'Error',
        description: 'Failed to save cause code',
        variant: 'destructive',
      });
    }
  };

  const filterTree = (nodes, query) => {
    if (!query) return nodes;
    const q = query.toLowerCase();
    // Recursively filter nodes and keep parents if any child matches
    return nodes
      .map(node => {
        if (node.name.toLowerCase().includes(q) || (node.code && node.code.toLowerCase().includes(q))) return node;
        if (node.children) {
          const filteredChildren = filterTree(node.children, query);
          if (filteredChildren.length > 0) return { ...node, children: filteredChildren };
        }
        return null;
      })
      .filter(Boolean);
  };

  const renderNode = (node: TreeNode, depth = 0) => (
    <div key={node.id} className="ml-2 mt-2">
      <Card className="flex items-center p-2 mb-1 shadow-sm border-l-4" style={{ borderLeftColor: '#3B82F6', marginLeft: depth * 16 }}>
        <div className="flex items-center flex-1 gap-2">
          {node.children && node.children.length > 0 && (
            <button onClick={() => handleExpand(String(node.id))} className="focus:outline-none">
              {expanded.has(String(node.id)) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          <FolderTree className="w-4 h-4 text-blue-500" />
          <span className="font-medium text-gray-800">{node.name}</span>
          <Badge className={categoryColors[node.category] || 'bg-gray-100 text-gray-800'}>{node.category}</Badge>
          <span className="text-xs text-gray-400 ml-2">{node.code}</span>
          {node.description && <span className="text-xs text-gray-500 ml-2">{node.description}</span>}
        </div>
        <div className="flex gap-1 ml-auto">
          <Button size="icon" variant="ghost" title="Add Child" onClick={() => openAddDialog(node)}><Plus className="w-4 h-4 text-green-600" /></Button>
          <Button size="icon" variant="ghost" title="Edit" onClick={() => openEditDialog(node)}><Edit className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" title="Delete" onClick={() => handleDelete(node)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
        </div>
      </Card>
      {expanded.has(String(node.id)) && node.children && node.children.length > 0 && (
        <div className="ml-4">
          {node.children.map(child => renderNode(child, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <FolderTree className="h-5 w-5 text-blue-600" />
        <CardTitle className="text-lg">RCA Cause Library</CardTitle>
        <Button size="sm" className="ml-auto" onClick={() => openAddDialog(null)}>
          <Plus className="w-4 h-4 mr-1" /> Add Top-Level Cause
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex items-center gap-2">
          <input
            type="text"
            className="border rounded px-2 py-1 w-full"
            placeholder="Search by name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {filterTree(tree, search).map(node => renderNode(node))}
      </CardContent>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? (parentForAdd ? 'Add Child Cause' : 'Add Top-Level Cause') : 'Edit Cause'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDialogSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Code</label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
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
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit">{dialogMode === 'add' ? 'Add' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default RCACauseLibraryTree; 