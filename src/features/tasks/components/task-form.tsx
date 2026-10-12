import { useId, useState, type FormEvent } from 'react';
import { useAssignableUsers } from '@/api/v2/queries/administration-users';
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from '@/api/v2/types/administration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/admin/shared/form-field';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { labelOf, TASK_LINK_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/features/ux-kit/labels';
import { StatusIcon } from '@/lib/icons';
import { type TaskFormErrors, type TaskFormValues, validateTaskForm } from '../model/task-form';

export interface TaskFormProps {
  initial: TaskFormValues;
  /** the current assignee's name when it is no longer an active member (kept selectable) */
  assigneeName?: string | null;
  readOnly: boolean;
  submitLabel: string;
  onSubmit: (values: TaskFormValues) => Promise<unknown>;
  onCancel: () => void;
}

function ChoiceField<T extends string>(props: { id: string; label: string; value: T; options: readonly T[]; labels: Readonly<Record<string, string>>; disabled: boolean; onChange: (value: T) => void }) {
  return (
    <FormField htmlFor={props.id} label={props.label}>
      <Select value={props.value} onValueChange={(value) => props.onChange(value as T)} disabled={props.disabled}>
        <SelectTrigger id={props.id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((option) => (
            <SelectItem key={option} value={option}>
              {labelOf(props.labels, option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function AssigneeField({ id, value, fallbackName, error, disabled, onChange }: { id: string; value: string; fallbackName?: string | null; error?: string; disabled: boolean; onChange: (id: string) => void }) {
  const members = useAssignableUsers();
  const items = members.data?.items ?? [];
  const missing = value && !items.some((member) => member.id === value);
  return (
    <FormField htmlFor={id} label="Assignee" error={error} hint={members.data?.nextCursor ? 'Showing the first 500 members.' : undefined} required>
      <Select value={value} onValueChange={onChange} disabled={disabled || members.isLoading}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={members.isLoading ? 'Loading people…' : 'Choose who does it'} />
        </SelectTrigger>
        <SelectContent>
          {missing && <SelectItem value={value}>{fallbackName ?? 'Former member'}</SelectItem>}
          {items.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

/** Title, description, assignee, priority, status and due day of a task; the link is shown, not typed. */
export function TaskForm({ initial, assigneeName, readOnly, submitLabel, onSubmit, onCancel }: TaskFormProps) {
  const ids = { title: useId(), description: useId(), assignee: useId(), priority: useId(), status: useId() };
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<TaskFormValues>) => setValues((current) => ({ ...current, ...patch }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateTaskForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await onSubmit(values);
    } catch {
      // the toast explains the refusal; the form keeps what was typed
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <FormField htmlFor={ids.title} label="Title" error={errors.title} required>
          <Input id={ids.title} value={values.title} disabled={readOnly} onChange={(e) => set({ title: e.target.value })} />
        </FormField>
      </div>
      <div className="sm:col-span-2">
        <FormField htmlFor={ids.description} label="Description">
          <Textarea id={ids.description} rows={3} value={values.description} disabled={readOnly} onChange={(e) => set({ description: e.target.value })} />
        </FormField>
      </div>
      <AssigneeField id={ids.assignee} value={values.assigneeId} fallbackName={assigneeName} error={errors.assigneeId} disabled={readOnly} onChange={(assigneeId) => set({ assigneeId })} />
      <DateInput label="Due date" value={values.dueDate} disabled={readOnly} onChange={(dueDate) => set({ dueDate })} />
      <ChoiceField<TaskPriority> id={ids.priority} label="Priority" value={values.priority} options={TASK_PRIORITIES} labels={TASK_PRIORITY_LABELS} disabled={readOnly} onChange={(priority) => set({ priority })} />
      <ChoiceField<TaskStatus> id={ids.status} label="Status" value={values.status} options={TASK_STATUSES} labels={TASK_STATUS_LABELS} disabled={readOnly} onChange={(status) => set({ status })} />
      {values.linkType && (
        <div className="flex items-center gap-3 text-sm sm:col-span-2">
          <span>Linked to: {labelOf(TASK_LINK_LABELS, values.linkType)}</span>
          {!readOnly && (
            <Button type="button" variant="link" className="h-auto p-0" onClick={() => set({ linkType: '', linkId: '' })}>
              Remove link
            </Button>
          )}
        </div>
      )}
      {!readOnly && (
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
            {busy && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
            {submitLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      )}
    </form>
  );
}
