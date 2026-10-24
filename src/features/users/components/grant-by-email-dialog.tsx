import { useId, useState, type FormEvent } from 'react';
import { useGrantScope, useUserLookup } from '@/api/v2/queries/administration-users';
import { V2ApiError } from '@/api/v2/errors';
import type { UserView } from '@/api/v2/types/administration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminDialog } from '@/features/admin/shared/admin-dialog';
import { FormField } from '@/features/admin/shared/form-field';
import { useCommandFeedback } from '@/features/admin/shared/use-command-feedback';
import { roleLabel } from '@/features/ux-kit/labels';
import { ActionIcon, StatusIcon } from '@/lib/icons';
import { EMPTY_SCOPE_CHOICE, scopeOf } from '../model/scope-choice';
import { GrantScopeFields } from './grant-scope-fields';

const INFO = 'Find a user of your organization by exact e-mail (no partial search) and give them a role in this plant. Their profile stays with their home plant. The change is recorded in the audit log.';

function LookupResult({ email, user, error, loading }: { email: string | null; user: UserView | null; error: unknown; loading: boolean }) {
  if (!email) return null;
  if (loading) return <p className="text-sm text-muted-foreground">Looking up {email}…</p>;
  if (error) {
    const notFound = error instanceof V2ApiError && error.status === 404;
    return (
      <p role="alert" className="text-sm text-destructive">
        {notFound ? 'No user of your organization has this e-mail.' : 'The user could not be looked up. Try again.'}
      </p>
    );
  }
  if (!user) return null;
  return (
    <p className="rounded-md border p-3 text-sm">
      <span className="font-medium">{user.name}</span> · {roleLabel(user.role)} · Home plant: {user.tenantName ?? user.organizationName ?? 'none'}
    </p>
  );
}

/**
 * Grant a first role in this plant to a user of the organization, found by exact e-mail (owner decision
 * 2026-10-12): the user then appears in the plant's users with a "From <home plant>" badge.
 */
export function GrantByEmailDialog() {
  const emailId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [choice, setChoice] = useState(EMPTY_SCOPE_CHOICE);
  const lookup = useUserLookup(email);
  const grant = useGrantScope();
  const feedback = useCommandFeedback();
  const found = email && !lookup.isError ? (lookup.data ?? null) : null;

  const reset = (next: boolean) => {
    setOpen(next);
    if (next) return;
    setDraft('');
    setEmail(null);
    setChoice(EMPTY_SCOPE_CHOICE);
  };
  const find = (event: FormEvent) => {
    event.preventDefault();
    setEmail(draft.trim() || null);
  };
  const submit = async () => {
    if (!found) return;
    try {
      await feedback(() => grant.submit({ email: found.email, ...scopeOf(choice) }), `Access granted to ${found.name}`);
      reset(false);
    } catch {
      // the toast explains the refusal; the dialog stays open
    }
  };
  const footer = (
    <>
      <Button variant="outline" className="h-9" onClick={() => reset(false)} disabled={grant.isPending}>
        Cancel
      </Button>
      <Button className="h-9" onClick={() => void submit()} disabled={!found || !choice.role || grant.isPending} aria-busy={grant.isPending || undefined}>
        {grant.isPending && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
        Grant access
      </Button>
    </>
  );

  return (
    <AdminDialog
      open={open}
      onOpenChange={reset}
      trigger={
        <Button variant="outline" className="h-9">
          <ActionIcon.add aria-hidden="true" />
          Grant access by e-mail
        </Button>
      }
      title="Grant access to a user of another plant"
      info={INFO}
      footer={footer}
      testId="grant-by-email-dialog"
    >
      <form onSubmit={find}>
        <FormField htmlFor={emailId} label="E-mail">
          <div className="flex gap-2">
            <Input id={emailId} type="email" className="h-9" value={draft} autoComplete="off" onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" variant="outline" className="h-9" disabled={!draft.trim()}>
              Find
            </Button>
          </div>
        </FormField>
      </form>
      <LookupResult email={email} user={found} error={lookup.error} loading={lookup.isLoading} />
      {found && <GrantScopeFields value={choice} onChange={setChoice} />}
    </AdminDialog>
  );
}
