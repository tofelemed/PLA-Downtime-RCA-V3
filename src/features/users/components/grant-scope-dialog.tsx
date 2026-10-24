import { useState } from 'react';
import { useGrantScope } from '@/api/v2/queries/administration-users';
import { Button } from '@/components/ui/button';
import { AdminDialog } from '@/features/admin/shared/admin-dialog';
import { useCommandFeedback } from '@/features/admin/shared/use-command-feedback';
import { ActionIcon, StatusIcon } from '@/lib/icons';
import { EMPTY_SCOPE_CHOICE, scopeOf } from '../model/scope-choice';
import { GrantScopeFields } from './grant-scope-fields';

const INFO = 'The role applies in this plant, or only in one of its units. The change is recorded in the audit log.';

/** Grant a scope role (viewer, reliability engineer, …) in the whole plant or one unit: two fields. */
export function GrantScopeDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(EMPTY_SCOPE_CHOICE);
  const grant = useGrantScope();
  const feedback = useCommandFeedback();

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) setChoice(EMPTY_SCOPE_CHOICE);
  };
  const submit = async () => {
    try {
      await feedback(() => grant.submit({ userId, ...scopeOf(choice) }), 'Access granted');
      close(false);
    } catch {
      // the toast explains the refusal; the dialog stays open
    }
  };
  const footer = (
    <>
      <Button variant="outline" className="h-9" onClick={() => close(false)} disabled={grant.isPending}>
        Cancel
      </Button>
      <Button className="h-9" onClick={() => void submit()} disabled={!choice.role || grant.isPending} aria-busy={grant.isPending || undefined}>
        {grant.isPending && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
        Grant access
      </Button>
    </>
  );

  return (
    <AdminDialog
      open={open}
      onOpenChange={close}
      trigger={
        <Button variant="outline" className="h-9">
          <ActionIcon.add aria-hidden="true" />
          Grant access
        </Button>
      }
      title={`Grant access to ${userName}`}
      info={INFO}
      footer={footer}
      testId="grant-scope-dialog"
    >
      <GrantScopeFields value={choice} onChange={setChoice} />
    </AdminDialog>
  );
}
