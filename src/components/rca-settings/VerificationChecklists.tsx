import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { masterDataService, VerificationStatusCode } from '../../services/MasterDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ChecklistFormData {
  code: string;
  name: string;
  description: string;
  color: string;
  items: string[];
}

function DraggableChecklistItem({ id, children, ...props }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        background: isDragging ? '#f3f4f6' : undefined,
      }}
      {...attributes}
      {...listeners}
      {...props}
    >
      {children}
    </li>
  );
}

const VerificationChecklists: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [checklists, setChecklists] = useState<VerificationStatusCode[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<VerificationStatusCode | null>(null);
  const [formData, setFormData] = useState<ChecklistFormData>({
    code: '',
    name: '',
    description: '',
    color: '#3B82F6',
    items: [],
  });
  const [newItem, setNewItem] = useState('');
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editingItemValue, setEditingItemValue] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [session]);

  const loadData = async () => {
    if (!session?.tenant?.id) return;
    try {
      const data = await masterDataService.getVerificationStatusCodes({ tenantId: session.tenant.id });
      setChecklists(data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load verification checklists', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({ code: '', name: '', description: '', color: '#3B82F6', items: [] });
    setEditingChecklist(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (checklist: VerificationStatusCode) => {
    setEditingChecklist(checklist);
    setFormData({
      code: checklist.code,
      name: checklist.name,
      description: checklist.description || '',
      color: checklist.color || '#3B82F6',
      items: checklist.items || [],
    });
    setShowForm(true);
  };

  const handleDelete = async (checklist: VerificationStatusCode) => {
    if (!window.confirm(`Are you sure you want to delete "${checklist.name}"?`)) return;
    try {
      await masterDataService.deleteVerificationStatusCode(checklist.id);
      toast({ title: 'Success', description: 'Verification checklist deleted successfully' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete verification checklist', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!session?.tenant?.id) return;
    try {
      if (editingChecklist) {
        await masterDataService.updateVerificationStatusCode(editingChecklist.id, {
          code: formData.code,
          name: formData.name,
          description: formData.description,
          color: formData.color,
          items: formData.items,
        });
        toast({ title: 'Success', description: 'Verification checklist updated successfully' });
      } else {
        await masterDataService.createVerificationStatusCode({
          code: formData.code,
          name: formData.name,
          description: formData.description,
          color: formData.color,
          items: formData.items,
          tenantId: session.tenant.id,
        });
        toast({ title: 'Success', description: 'Verification checklist created successfully' });
      }
      resetForm();
      setShowForm(false);
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save verification checklist', variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(checklists, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verification-checklists.json';
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
          for (const checklist of imported) {
            await masterDataService.createVerificationStatusCode(checklist);
          }
          toast({ title: 'Import complete', description: `${imported.length} checklists imported.` });
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

  const filteredChecklists = checklists.filter(cl =>
    cl.name.toLowerCase().includes(search.toLowerCase()) ||
    cl.code.toLowerCase().includes(search.toLowerCase()) ||
    (cl.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} selected checklists?`)) return;
    for (const id of selected) {
      await masterDataService.deleteVerificationStatusCode(id);
    }
    setSelected([]);
    loadData();
    toast({ title: 'Deleted', description: `${selected.length} checklists deleted.` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          Verification Checklists
          <Button className="ml-auto" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" /> Add Checklist
          </Button>
          <Button variant="outline" className="ml-2" onClick={handleExport} title="Export Checklists">
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <label className="ml-2 cursor-pointer flex items-center" title="Import Checklists">
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
            placeholder="Search checklists..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <CardDescription>Manage verification checklists for your tenant</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChecklists.map(checklist => (
            <Card key={checklist.id} className="border p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(checklist.id)}
                    onChange={e => setSelected(sel => e.target.checked ? [...sel, checklist.id] : sel.filter(id => id !== checklist.id))}
                  />
                  <div className="font-semibold text-lg">{checklist.name}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(checklist)}><Edit className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(checklist)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </div>
              <div className="text-sm text-gray-500 mb-1">Code: {checklist.code}</div>
              <div className="text-sm text-gray-500 mb-1">Color: <span style={{ background: checklist.color }} className="inline-block w-4 h-4 rounded-full align-middle ml-1"></span></div>
              <div className="text-xs text-gray-400">{checklist.description}</div>
            </Card>
          ))}
        </div>
      </CardContent>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChecklist ? 'Edit Checklist' : 'Add Checklist'}</DialogTitle>
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
              <Label>Color</Label>
              <Input type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div>
              <Label>Checklist Items</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={editingItemIdx !== null ? editingItemValue : newItem}
                  onChange={e => {
                    if (editingItemIdx !== null) setEditingItemValue(e.target.value);
                    else setNewItem(e.target.value);
                  }}
                  placeholder="Add new item"
                />
                {editingItemIdx !== null ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        items: prev.items.map((item, idx) => idx === editingItemIdx ? editingItemValue : item),
                      }));
                      setEditingItemIdx(null);
                      setEditingItemValue('');
                    }}
                  >Save</Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      if (newItem.trim()) {
                        setFormData(prev => ({ ...prev, items: [...prev.items, newItem.trim()] }));
                        setNewItem('');
                      }
                    }}
                  >Add</Button>
                )}
              </div>
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={event => {
                  const { active, over } = event;
                  if (active.id !== over?.id) {
                    setFormData(prev => ({
                      ...prev,
                      items: arrayMove(prev.items, prev.items.findIndex(i => i === active.id), prev.items.findIndex(i => i === over?.id)),
                    }));
                  }
                }}
              >
                <SortableContext items={formData.items} strategy={verticalListSortingStrategy}>
                  <ul className="list-disc ml-6">
                    {formData.items.map((item, idx) => (
                      <DraggableChecklistItem key={item} id={item}>
                        <span>{item}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={() => {
                          setEditingItemIdx(idx);
                          setEditingItemValue(item);
                        }}>Edit</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}>Delete</Button>
                        {idx > 0 && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => setFormData(prev => ({
                            ...prev,
                            items: prev.items.map((it, i) =>
                              i === idx - 1 ? prev.items[idx] : i === idx ? prev.items[idx - 1] : it
                            ),
                          }))}>↑</Button>
                        )}
                        {idx < formData.items.length - 1 && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => setFormData(prev => ({
                            ...prev,
                            items: prev.items.map((it, i) =>
                              i === idx + 1 ? prev.items[idx] : i === idx ? prev.items[idx + 1] : it
                            ),
                          }))}>↓</Button>
                        )}
                      </DraggableChecklistItem>
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">{editingChecklist ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default VerificationChecklists; 