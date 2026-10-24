import { useState } from 'react';
import type { RcaActionView } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { ActionIcon } from '@/lib/icons';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_BASELINE_METRIC_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionBaseline } from './action-baseline';
import { ActionCancelInfo } from './action-cancel-info';
import { ActionCompletion } from './action-completion';
import { ActionEditForm } from './action-edit-form';
import { ActionLinks } from './action-links';
import { ActionMeta } from './action-meta';
import { ActionStatusControls } from './action-status-controls';
import { ActionVerdict } from './action-verdict';
import { useActionAccess } from './use-action-access';
import { useCanWriteRca } from './use-can-write-rca';

/** One action: type, owner, status, completion evidence, baseline, verification and the server's verdict. */
export function ActionRow({ action }: { action: RcaActionView }) {
  const canWriteRca = useCanWriteRca();
  const access = useActionAccess(action);
  const [editing, setEditing] = useState(false);
  const realized = action.postAction?.realized;
  const { decimal } = useNumberFormat();
  return (
    <li id={`action-${action.id}`} className="space-y-3 p-3 text-sm" data-testid="action-row">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 pt-2 font-medium text-heading">{action.title}</h3>
        <div className="flex flex-wrap items-start gap-2">
          {canWriteRca && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="edit-action">
              <ActionIcon.edit aria-hidden="true" className="mr-1 h-4 w-4" />
              Edit
            </Button>
          )}
          <ActionStatusControls action={action} />
        </div>
      </div>
      <ActionMeta action={action} />
      <ActionLinks action={action} canWrite={canWriteRca} />
      <ActionCancelInfo action={action} />
      {editing && <ActionEditForm key={action.rowVersion} action={action} onDone={() => setEditing(false)} />}
      <details className="rounded-md border" data-testid="action-details">
        <summary className="cursor-pointer px-3 py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Evidence & effectiveness</summary>
        <div className="space-y-3 border-t p-3">
          <ActionCompletion key={action.rowVersion} action={action} access={access} />
          <ActionBaseline action={action} />
          <ActionVerdict action={action} />
          {realized && (
            <p data-testid="realized">
              Realized: expected {decimal(realized.expected, 2)}, observed {decimal(realized.observed, 2)}, difference{' '}
              <strong>{decimal(realized.difference, 2)}</strong> ({labelOf(RCA_BASELINE_METRIC_LABELS, realized.metric).toLowerCase()})
            </p>
          )}
        </div>
      </details>
    </li>
  );
}
