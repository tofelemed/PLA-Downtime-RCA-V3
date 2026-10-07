import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { masterDataService, RCATemplate } from '../../services/MasterDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import RCACauseLibraryTree from './RCACauseLibraryTree';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LogicTreeBuilder, { LogicTreeNode } from './LogicTreeBuilder';
import { Dialog as FullScreenDialog } from '@/components/ui/dialog';

interface RCATemplateFormData {
  name: string;
  description: string;
  category: string;
  logicTreeStructure: any;
  verificationChecklist: string[];
}

const RCATemplates: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<RCATemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RCATemplate | null>(null);
  const [formData, setFormData] = useState<RCATemplateFormData>({
    name: '',
    description: '',
    category: '',
    logicTreeStructure: {},
    verificationChecklist: [],
  });
  const [availableChecklists, setAvailableChecklists] = useState<any[]>([]);
  const [treeData, setTreeData] = useState<LogicTreeNode[]>([]); // Local tree for the template
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  useEffect(() => {
    console.log('[RCATemplates] useEffect session:', session);
    loadData();
    loadChecklists();
  }, [session]);

  const loadData = async () => {
    console.log('[RCATemplates] loadData - Loading ALL templates (Master Data view)');
    try {
      // Load ALL RCA templates without tenant filter (Master Data should show all)
      const data = await masterDataService.getRCATemplates({});
      console.log(`[RCATemplates] ✅ Loaded ${data.length} RCA templates (ALL tenants)`);
      setTemplates(data);
    } catch (error) {
      console.error('[RCATemplates] ❌ Failed to load RCA templates:', error);
      toast({ title: 'Error', description: 'Failed to load RCA templates', variant: 'destructive' });
    }
  };

  const loadChecklists = async () => {
    console.log('[RCATemplates] loadChecklists - Loading ALL checklists (Master Data view)');
    try {
      // Load ALL verification checklists without tenant filter
      const data = await masterDataService.getVerificationStatusCodes({});
      console.log(`[RCATemplates] ✅ Loaded ${data.length} verification checklists (ALL tenants)`);
      setAvailableChecklists(data);
    } catch (error) {
      console.error('[RCATemplates] ❌ Failed to load checklists:', error);
      toast({ title: 'Error', description: 'Failed to load checklists', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', category: '', logicTreeStructure: {}, verificationChecklist: [] });
    setEditingTemplate(null);
  };

  const handleCreate = () => {
    resetForm();
    setTreeData([]);
    setShowForm(true);
  };

  const handleEdit = (template: RCATemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category || '',
      logicTreeStructure: template.logicTreeStructure || {},
      verificationChecklist: Array.isArray(template.verificationChecklist) ? template.verificationChecklist : [],
    });
    setTreeData(template.logicTreeStructure?.nodes || []);
    setShowForm(true);
  };

  const handleDelete = async (template: RCATemplate) => {
    if (!window.confirm(`Are you sure you want to delete "${template.name}"?`)) return;
    try {
      await masterDataService.deleteRCATemplate(template.id);
      toast({ title: 'Success', description: 'RCA template deleted successfully' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete RCA template', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!session?.organization?.id && !session?.tenant?.id) return;
    try {
      if (editingTemplate) {
        await masterDataService.updateRCATemplate(editingTemplate.id, {
          name: formData.name,
          description: formData.description,
          category: formData.category,
          logicTreeStructure: formData.logicTreeStructure,
          verificationChecklist: formData.verificationChecklist,
        });
        toast({ title: 'Success', description: 'RCA template updated successfully' });
      } else {
        await masterDataService.createRCATemplate({
          name: formData.name,
          description: formData.description,
          category: formData.category,
          logicTreeStructure: formData.logicTreeStructure,
          verificationChecklist: formData.verificationChecklist,
          organizationId: session.organization?.id,
          tenantId: session.tenant?.id,
        });
        toast({ title: 'Success', description: 'RCA template created successfully' });
      }
      resetForm();
      setShowForm(false);
      setUnsavedChanges(false);
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save RCA template', variant: 'destructive' });
    }
  };

  const handleTreeChange = (newTree: LogicTreeNode[]) => {
    setTreeData(newTree);
    setFormData(prev => ({ ...prev, logicTreeStructure: { nodes: newTree } }));
    setUnsavedChanges(true);
    if (editingTemplate) {
      masterDataService.updateRCATemplate(editingTemplate.id, {
        ...editingTemplate,
        logicTreeStructure: { nodes: newTree },
      });
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(templates, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rca-templates.json';
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
          // Optionally, you could merge or replace
          // Here, we just add them (could deduplicate by name/id)
          for (const tpl of imported) {
            await masterDataService.createRCATemplate(tpl);
          }
          toast({ title: 'Import complete', description: `${imported.length} templates imported.` });
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

  const filteredTemplates = templates.filter(tpl =>
    tpl.name.toLowerCase().includes(search.toLowerCase()) ||
    tpl.category.toLowerCase().includes(search.toLowerCase()) ||
    (tpl.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} selected templates?`)) return;
    for (const id of selected) {
      await masterDataService.deleteRCATemplate(id);
    }
    setSelected([]);
    loadData();
    toast({ title: 'Deleted', description: `${selected.length} templates deleted.` });
  };

  const renderTreePreview = (node: LogicTreeNode) => (
    <li key={node.id}>
      <span className="font-semibold">{node.name}</span>
      {node.code && <span className="ml-2 text-gray-500">[{node.code}]</span>}
      {node.category && <span className="ml-2 text-blue-600">{node.category}</span>}
      {node.description && <span className="ml-2 text-gray-400">{node.description}</span>}
      {node.children && node.children.length > 0 && (
        <ul className="ml-4">
          {node.children.map(child => renderTreePreview(child))}
        </ul>
      )}
    </li>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          RCA Templates
          <Button className="ml-auto" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" /> Add Template
          </Button>
          <Button variant="outline" className="ml-2" onClick={handleExport} title="Export Templates">
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <label className="ml-2 cursor-pointer flex items-center" title="Import Templates">
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
            placeholder="Search templates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <CardDescription>Manage RCA templates for your organization/tenant</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <Card key={template.id} className="border p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(template.id)}
                    onChange={e => setSelected(sel => e.target.checked ? [...sel, template.id] : sel.filter(id => id !== template.id))}
                  />
                  <div className="font-semibold text-lg">{template.name}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(template)}><Edit className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(template)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </div>
              <div className="text-sm text-gray-500 mb-1">Category: {template.category}</div>
              <div className="text-xs text-gray-400">{template.description}</div>
            </Card>
          ))}
        </div>
      </CardContent>
      <Dialog open={showForm} onOpenChange={open => {
        if (!open && unsavedChanges && !editingTemplate) {
          if (window.confirm('You have unsaved changes. Keep changes and stay, or discard them? Click OK to discard, Cancel to keep editing.')) {
            setShowForm(false);
            setUnsavedChanges(false);
          } else {
            // Stay open
            return;
          }
        } else {
          setShowForm(open);
          if (!open) setUnsavedChanges(false);
        }
      }}>
        <DialogContent className="w-screen max-w-full h-screen p-0 flex flex-col">
          <DialogHeader className="px-8 pt-8 pb-4">
            <DialogTitle>{editingTemplate ? 'Edit RCA Template' : 'Add RCA Template'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-row gap-0 h-full overflow-hidden">
            {/* Left: Tree View */}
            <div className="w-full max-w-md border-r h-full flex flex-col bg-gray-50">
              <div className="flex-1 overflow-auto p-4 relative">
                <LogicTreeBuilder
                  treeData={treeData}
                  onTreeChange={handleTreeChange}
                  editable
                />
              </div>
            </div>
            {/* Right: Edit Form */}
            <div className="flex-1 p-8 overflow-auto">
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
                  <Label>Category</Label>
                  <Input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <div>
                  <Label>Verification Checklists</Label>
                  <div className="flex flex-col gap-2">
                    {availableChecklists.map(cl => (
                      <label key={cl.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.verificationChecklist.includes(cl.id)}
                          onChange={e => {
                            setFormData(prev => ({
                              ...prev,
                              verificationChecklist: e.target.checked
                                ? [...prev.verificationChecklist, cl.id]
                                : prev.verificationChecklist.filter((id: string) => id !== cl.id),
                            }));
                          }}
                        />
                        {cl.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-8">
                  <Button type="button" variant="outline" onClick={() => {
                    if (unsavedChanges && !editingTemplate) {
                      if (window.confirm('You have unsaved changes. Keep changes and stay, or discard them? Click OK to discard, Cancel to keep editing.')) {
                        setShowForm(false);
                        setUnsavedChanges(false);
                      }
                    } else {
                      setShowForm(false);
                      setUnsavedChanges(false);
                    }
                  }}>Cancel</Button>
                  <Button type="submit">{editingTemplate ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default RCATemplates; 