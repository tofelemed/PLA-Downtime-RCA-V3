import { useState } from 'react';
import { useGrantScope } from '@/api/v2/queries/administration-users';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCommandFeedback } from '@/features/admin/shared/use-command-feedback';
import { ActionIcon, StatusIcon } from '@/lib/icons';
import { EMPTY_SCOPE_CHOICE, scopeOf } from '../model/scope-choice';
import { GrantScopeFields } from './grant-scope-fields';

/** Grant a scope role (viewer, reliability engineer, …) in the whole plant or one unit: two fields. */
export function GrantScopeDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(EMPTY_SCOPE_CHOICE);
  const grant = useGrantScope();
  const feedback = useCommandFeedback();

  const submit = async () => {
    try {
      await feedback(() => grant.submit({ userId, ...scopeOf(choice) }), 'Access granted');
      setOpen(false);
      setChoice(EMPTY_SCOPE_CHOICE);
    } catch {
      // the toast explains the refusal; the dialog stays open
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ActionIcon.add aria-hidden="true" />
          Grant access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grant access to {userName}</DialogTitle>
          <DialogDescription>The role applies in this plant, or only in one of its units. The change is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <GrantScopeFields value={choice} onChange={setChoice} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={grant.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!choice.role || grant.isPending} aria-busy={grant.isPending || undefined}>
            {grant.isPending && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
            Grant access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
