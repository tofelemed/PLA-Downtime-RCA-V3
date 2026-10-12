import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { useToast } from '@/hooks/use-toast';
import type { RecordResource } from '../api/record-resource';
import { useRecordLifecycle } from '../api/use-record-commands';

export interface LifecycleActionsProps {
  source: RecordResource;
  id: string;
  retired: boolean;
  /** what the record is called in text, e.g. "unit" */
  kind: string;
  /** the record's name, e.g. "Extruder line 3" */
  name: string;
  /** what retiring keeps / stops, shown in the confirmation */
  retireNote: string;
}

/**
 * Retire (confirmed, destructive) or restore one record. Retire replaces the v1 delete: history and
 * references stay, and new records can no longer pick it. Refusals (e.g. a unit with active assets) are
 * shown in the confirmation and as a toast.
 */
export function LifecycleActions({ source, id, retired, kind, name, retireNote }: LifecycleActionsProps) {
  const { toast } = useToast();
  const retire = useRecordLifecycle<{ id: string }>(source, 'retire');
  const restore = useRecordLifecycle<{ id: string }>(source, 'restore');
  const run = async (action: typeof retire, done: string) => {
    try {
      await action.submit({ id });
      toast({ title: done });
    } catch (error) {
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
      throw error;
    }
  };
  if (retired) {
    return (
      <Button variant="outline" disabled={restore.isPending} onClick={() => void run(restore, `${capitalize(kind)} restored`).catch(() => undefined)}>
        Restore {kind}
      </Button>
    );
  }
  return (
    <ConfirmDialog
      trigger={<Button variant="outline">Retire {kind}</Button>}
      title={`Retire ${name}?`}
      description={retireNote}
      confirmLabel={`Retire ${kind}`}
      destructive
      onConfirm={() => run(retire, `${capitalize(kind)} retired`)}
    />
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
