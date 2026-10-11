import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import {
  taskApi,
  TaskDto,
  CreateTaskPayload,
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_ENTITY_TYPES,
} from '../services/api/taskApi';
import { userApi, AssignableUser } from '../services/api/userApi';
import { auditService } from '../services/AuditService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckSquare, Plus, Edit, Trash2, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-800',
  Medium: 'bg-blue-100 text-blue-800',
  High: 'bg-amber-100 text-amber-800',
  Critical: 'bg-red-100 text-red-800',
};

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-purple-100 text-purple-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-gray-100 text-gray-500',
};

const emptyForm = {
  title: '',
  description: '',
  assignedTo: '',
  priority: 'Medium' as string,
  status: 'Open' as string,
  dueDate: '',
  entityType: 'General' as string,
  entityId: '',
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

function isOverdue(task: TaskDto) {
  if (!task.dueDate || task.status === 'Completed') return false;
  return new Date(task.dueDate) < new Date();
}

export default function Tasks() {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);

  const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;
  const organizationId =
    plantSelection?.organization?.id ||
    session?.organization?.id ||
    session?.tenant?.organizationId ||
    '';

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const loadTasks = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const query: Parameters<typeof taskApi.list>[0] = { tenantId };
      if (myTasksOnly && session?.user?.id) query.assignedTo = session.user.id;
      if (statusFilter !== 'all') query.status = statusFilter;
      if (priorityFilter !== 'all') query.priority = priorityFilter;
      if (overdueOnly) query.overdue = true;

      const [taskList, userList] = await Promise.all([
        taskApi.list(query),
        userApi.getAssignableUsers(),
      ]);
      setTasks(taskList);
      setUsers(userList);
    } catch (error: any) {
      toast({ title: 'Failed to load tasks', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, myTasksOnly, statusFilter, priorityFilter, overdueOnly, session?.user?.id, toast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      assignedTo: session?.user?.id || '',
    });
    setDialogOpen(true);
  };

  const openEdit = (task: TaskDto) => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description || '',
      assignedTo: task.assignedTo,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      entityType: task.entityType || 'General',
      entityId: task.entityId || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !tenantId || !organizationId) return;
    if (!form.title.trim() || !form.assignedTo) {
      toast({ title: 'Validation', description: 'Title and assignee are required.', variant: 'destructive' });
      return;
    }

    try {
      const payload: CreateTaskPayload = {
        title: form.title.trim(),
        description: form.description || undefined,
        assignedTo: form.assignedTo,
        assignedBy: session.user.id,
        priority: form.priority,
        status: form.status,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        entityType: form.entityType !== 'General' ? form.entityType : undefined,
        entityId: form.entityId || undefined,
        organizationId,
        tenantId,
      };

      if (editing) {
        await taskApi.update(editing.id, payload, { clientAudited: true });
        await auditService.logUpdate('Task', editing.id, form.title, session.user.id, session.user.name, organizationId, tenantId);
        toast({ title: 'Task updated' });
      } else {
        const created = await taskApi.create(payload, { clientAudited: true });
        await auditService.logCreate('Task', created.id, form.title, session.user.id, session.user.name, organizationId, tenantId);
        toast({ title: 'Task created' });
      }
      setDialogOpen(false);
      loadTasks();
    } catch (error: any) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (task: TaskDto) => {
    if (!session || !window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await taskApi.delete(task.id, { clientAudited: true });
      await auditService.logDelete('Task', task.id, task.title, session.user.id, session.user.name, organizationId, tenantId || '');
      toast({ title: 'Task deleted' });
      loadTasks();
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleQuickStatus = async (task: TaskDto, status: string) => {
    if (!session) return;
    try {
      await taskApi.update(task.id, { status });
      loadTasks();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const stats = useMemo(() => ({
    total: tasks.length,
    open: tasks.filter((t) => t.status === 'Open').length,
    inProgress: tasks.filter((t) => t.status === 'In Progress').length,
    completed: tasks.filter((t) => t.status === 'Completed').length,
    overdue: tasks.filter(isOverdue).length,
  }), [tasks]);

  if (!session) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CheckSquare className="w-8 h-8 text-blue-600" />
            Task Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Assign, track, and complete action items linked to RCAs, events, and plans
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadTasks} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Open</p><p className="text-2xl font-bold text-blue-600">{stats.open}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">In Progress</p><p className="text-2xl font-bold text-purple-600">{stats.inProgress}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold text-green-600">{stats.completed}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Overdue</p><p className="text-2xl font-bold text-red-600">{stats.overdue}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Tasks</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant={myTasksOnly ? 'default' : 'outline'} size="sm" onClick={() => setMyTasksOnly((v) => !v)}>
                My Tasks
              </Button>
              <Button variant={overdueOnly ? 'destructive' : 'outline'} size="sm" onClick={() => setOverdueOnly((v) => !v)}>
                <AlertCircle className="w-4 h-4 mr-1" /> Overdue
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No tasks found. Create one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-4">Title</th>
                    <th className="pb-2 pr-4">Assignee</th>
                    <th className="pb-2 pr-4">Priority</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Due</th>
                    <th className="pb-2 pr-4">Linked To</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className={`border-b border-gray-100 hover:bg-muted/30 ${isOverdue(task) ? 'bg-red-50/50' : ''}`}>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{task.title}</p>
                        {task.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{task.description}</p>}
                      </td>
                      <td className="py-3 pr-4">{userMap.get(task.assignedTo) || task.assignedTo.slice(0, 8)}</td>
                      <td className="py-3 pr-4">
                        <Badge className={PRIORITY_COLORS[task.priority] || ''} variant="outline">{task.priority}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge className={STATUS_COLORS[task.status] || ''} variant="outline">{task.status}</Badge>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {isOverdue(task) && <Clock className="w-3 h-3 inline text-red-500 mr-1" />}
                        {fmtDate(task.dueDate)}
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        {task.entityType ? (
                          <span>{task.entityType}{task.entityId ? ` · ${task.entityId.slice(0, 8)}…` : ''}</span>
                        ) : '—'}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          {task.status !== 'Completed' && (
                            <Button size="sm" variant="ghost" title="Mark complete" onClick={() => handleQuickStatus(task, 'Completed')}>
                              <CheckSquare className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openEdit(task)}><Edit className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(task)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Task' : 'Create Task'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Assignee *</Label>
                <Select value={form.assignedTo} onValueChange={(v) => setForm((f) => ({ ...f, assignedTo: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Link Type</Label>
                <Select value={form.entityType} onValueChange={(v) => setForm((f) => ({ ...f, entityType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Link ID</Label>
                <Input value={form.entityId} onChange={(e) => setForm((f) => ({ ...f, entityId: e.target.value }))} placeholder="RCA / Event / Plan ID" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Create Task'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
