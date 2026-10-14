import { Button } from '@/components/ui/button';
import { newIdempotencyKey } from '@/api/v2/idempotency';
import { v2Request } from '@/api/v2/client';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import type { RecordResource } from '../api/record-resource';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface BulkRetireButtonProps {
  source: RecordResource;
  ids: readonly string[];
  /** plural noun, e.g. "templates" */
  what: string;
  onDone: () => void | Promise<void>;
}

/** "Retire selected (n)" behind a confirmation; reports how many were retired and how many were refused. */
export function BulkRetireButton({ source, ids, what, onDone }: BulkRetireButtonProps) {
  const { number } = useNumberFormat();
  const { toast } = useToast();
  if (ids.length === 0) return null;
  const retireAll = async () => {
    let refused = 0;
    for (const id of ids) {
      try {
        await v2Request({ method: 'POST', path: `${source.path}/${id}/retire`, body: {}, idempotencyKey: newIdempotencyKey() });
      } catch {
        refused += 1;
      }
    }
    await onDone();
    toast({
      title: `${number(ids.length - refused)} ${what} retired`,
      description: refused ? `${number(refused)} could not be retired (already retired, or still in use).` : undefined,
      variant: refused ? 'destructive' : undefined,
    });
  };
  return (
    <ConfirmDialog
      trigger={<Button variant="outline">Retire selected ({number(ids.length)})</Button>}
      title={`Retire ${number(ids.length)} ${what}?`}
      description="Retired records stay in history and can be restored one by one."
      confirmLabel={`Retire ${what}`}
      destructive
      onConfirm={retireAll}
    />
  );
}
