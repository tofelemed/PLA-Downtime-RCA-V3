import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import { TEAM_LOCKED_STATUSES } from '../../model/case-workflow';
import { buildDefinitionPatch } from '../../model/rca-form';
import { useRcaFormat } from '../../use-rca-format';
import { useCaseWorkspace } from '../case-context';
import { DefinitionFields } from '../overview/definition-fields';
import { TeamEditor } from '../overview/team-editor';
import { useCasePatch } from '../use-case-patch';
import { DefinitionDraftNotice } from './definition-draft-notice';
import { useDefinitionDraft, type DefinitionEditorDraft } from './use-definition-draft';

function SaveBar({ draft, pending, saved, onSave, onDiscard }: { draft: DefinitionEditorDraft; pending: boolean; saved: boolean; onSave: () => void; onDiscard: () => void }) {
  return <div className="flex flex-wrap items-center gap-2">
    <Button disabled={!draft.editable || !draft.dirty || draft.form.title.trim() === '' || pending} onClick={onSave} data-testid="save-case">Save case</Button>
    {draft.dirty && <ConfirmDialog
      trigger={<Button variant="outline" disabled={pending}>Discard changes</Button>}
      title="Discard your changes?"
      description="The definition and team go back to the saved investigation. What you typed since the last save is lost."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      destructive
      onConfirm={onDiscard}
    />}
    {saved && <span role="status" className="text-sm text-muted-foreground">Saved.</span>}
  </div>;
}

/** The definition uses the original scalar command; status remains a separate workflow action. */
export function DefinitionPage() {
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const { search } = useLocation();
  const { timezone } = useRcaFormat();
  const patch = useCasePatch();
  const draft = useDefinitionDraft(rca, timezone, !readOnly);
  const [saved, setSaved] = useState(false);
  const teamLocked = TEAM_LOCKED_STATUSES.includes(rca.status ?? '');
  const change: typeof draft.change = next => { setSaved(false); draft.change(next); };
  const discard = () => { draft.reset(); patch.reset(); setSaved(false); };
  const save = async () => {
    const result = await patch.save(buildDefinitionPatch(draft.form, draft.timezone), draft.rowVersion).catch(() => null);
    if (result) { draft.reset(result); setSaved(true); }
  };
  return <div className="space-y-5" data-testid="case-definition-page">
    <Link to={`${basePath}${search}`} className="text-sm font-medium underline">Back to overview</Link>
    <DefinitionDraftNotice draft={draft} />
    <Section title="Investigation definition" description="Status changes stay in the investigation workflow on Overview.">
      <DefinitionFields form={draft.form} onChange={change} readOnly={!draft.editable || patch.isPending} />
    </Section>
    <Section title="Team" description={teamLocked ? 'Fixed since the investigation was accepted, so the closure approver is judged against a known team. Reopen the investigation to change it.' : undefined}>
      <TeamEditor value={draft.form} onChange={change} readOnly={!draft.editable || teamLocked || patch.isPending} />
    </Section>
    {patch.error && <FriendlyErrorAlert error={patch.error} />}
    {!readOnly && <SaveBar draft={draft} pending={patch.isPending} saved={saved} onSave={() => void save()} onDiscard={discard} />}
  </div>;
}
