import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { masterDataService, RCACauseCode } from '../../services/MasterDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CauseFormData {
  code: string;
  name: string;
  description: string;
  category: 'Equipment' | 'Process' | 'Material' | 'Personnel' | 'Environment' | 'Method';
  parentId?: string;
}

const CauseLibraries: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [causes, setCauses] = useState<RCACauseCode[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCause, setEditingCause] = useState<RCACauseCode | null>(null);
  const [formData, setFormData] = useState<CauseFormData>({
    code: '',
    name: '',
    description: '',
    category: 'Equipment',
    parentId: '',
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [session]);

  const loadData = async () => {
    // Load ALL RCA cause codes without tenant filter (Master Data should show all codes)
    console.log('🔍 CauseLibraries: Loading RCA cause codes (ALL tenants)');
    try {
      const data = await masterDataService.getRCACauseCodes({});
      console.log(`   ✅ Loaded ${data.length} RCA cause codes`);
      setCauses(data);
    } catch (error) {
      console.error('❌ Failed to load RCA causes:', error);
      toast({ title: 'Error', description: 'Failed to load RCA causes', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({ code: '', name: '', description: '', category: 'Equipment', parentId: '' });
    setEditingCause(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (cause: RCACauseCode) => {
    setEditingCause(cause);
    setFormData({
      code: cause.code,
      name: cause.name,
      description: cause.description || '',
      category: cause.category || 'Equipment',
      parentId: cause.parentId || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (cause: RCACauseCode) => {
    if (!window.confirm(`Are you sure you want to delete "${cause.name}"?`)) return;
    try {
      await masterDataService.deleteRCACauseCode(cause.id);
      toast({ title: 'Success', description: 'RCA cause deleted successfully' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete RCA cause', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!session?.tenant?.id) return;
    try {
      if (editingCause) {
        await masterDataService.updateRCACauseCode(editingCause.id, {
          code: formData.code,
          name: formData.name,
          description: formData.description,
          category: formData.category,
          parentId: formData.parentId,
        });
        toast({ title: 'Success', description: 'RCA cause updated successfully' });
      } else {
        await masterDataService.createRCACauseCode({
          code: formData.code,
          name: formData.name,
          description: formData.description,
          category: formData.category,
          parentId: formData.parentId,
          tenantId: session.tenant.id,
        });
        toast({ title: 'Success', description: 'RCA cause created successfully' });
      }
      resetForm();
      setShowForm(false);
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save RCA cause', variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(causes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rca-cause-library.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          for (const cause of imported) {
            await masterDataService.createRCACauseCode(cause);
          }
          toast({ title: 'Import complete', description: `${imported.length} causes imported.` });
          loadData();
        } else {
          toast({ title: 'Import failed', description: 'Invalid file format', variant: 'destructive' });
        }
      } catch (err) {
        toast({ title: 'Import failed', description: 'Could not parse file', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  const filteredCauses = causes.filter(cause =>
    cause.name.toLowerCase().includes(search.toLowerCase()) ||
    cause.code.toLowerCase().includes(search.toLowerCase()) ||
    cause.category.toLowerCase().includes(search.toLowerCase()) ||
    (cause.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} selected causes?`)) return;
    for (const id of selected) {
      await masterDataService.deleteRCACauseCode(id);
    }
    setSelected([]);
    loadData();
    toast({ title: 'Deleted', description: `${selected.length} causes deleted.` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          Cause Libraries
          <Button className="ml-auto" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" /> Add Cause
          </Button>
          <Button variant="outline" className="ml-2" onClick={handleExport} title="Export Causes">
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <label className="ml-2 cursor-pointer flex items-center" title="Import Causes">
            <Upload className="w-4 h-4 mr-1" /> Import
            <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
          </label>
          {selected.length > 0 && (
            <Button variant="destructive" className="ml-2" onClick={handleBulkDelete} title="Delete Selected">
              Delete Selected ({selected.length})
            </Button>
          )}
        </CardTitle>
        <div className="mt-2 flex items-center gap-2">
          <Input
            placeholder="Search causes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <CardDescription>Manage RCA cause codes for your tenant</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCauses.filter(cause => !cause.parentId).map(cause => (
            <Card key={cause.id} className="border p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(cause.id)}
                    onChange={e => setSelected(sel => e.target.checked ? [...sel, cause.id] : sel.filter(id => id !== cause.id))}
                  />
                  <div className="font-semibold text-lg">{cause.name}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(cause)}><Edit className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(cause)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </div>
              <div className="text-sm text-gray-500 mb-1">Code: {cause.code}</div>
              <div className="text-sm text-gray-500 mb-1">Category: {cause.category}</div>
              <div className="text-xs text-gray-400">{cause.description}</div>
            </Card>
          ))}
        </div>
      </CardContent>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCause ? 'Edit Cause' : 'Add Cause'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Name</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div>
              <Label>Code</Label>
              <Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} required />
            </div>
            <div>
              <Label>Category</Label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as CauseFormData['category'] })}
                required
                className="w-full border rounded px-2 py-1"
              >
                <option value="Equipment">Equipment</option>
                <option value="Process">Process</option>
                <option value="Material">Material</option>
                <option value="Personnel">Personnel</option>
                <option value="Environment">Environment</option>
                <option value="Method">Method</option>
              </select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">{editingCause ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CauseLibraries; 