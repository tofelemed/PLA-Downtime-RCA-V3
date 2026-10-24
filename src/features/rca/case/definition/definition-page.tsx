import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { UiIcon } from '@/lib/icons';
import { TEAM_LOCKED_STATUSES } from '../../model/case-workflow';
import { buildDefinitionPatch } from '../../model/rca-form';
import { useRcaFormat } from '../../use-rca-format';
import { useCaseWorkspace } from '../case-context';
import { CaseCard } from '../components/case-card';
import { DefinitionFields } from '../overview/definition-fields';
import { TeamEditor } from '../overview/team-editor';
import { TEAM_LOCKED_INFO } from '../overview/team-summary';
import { useCasePatch } from '../use-case-patch';
import { DefinitionDraftNotice } from './definition-draft-notice';
import { DEFINITION_INFO } from './definition-info';
import { useDefinitionDraft, type DefinitionEditorDraft } from './use-definition-draft';

interface SaveBarProps {
  draft: DefinitionEditorDraft;
  pending: boolean;
  saved: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

/** Saved state left; Discard (secondary) left of Save (primary) on the right. */
function SaveBar({ draft, pending, saved, onSave, onDiscard }: SaveBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2" data-testid="definition-save-bar">
      {saved && <span role="status" className="mr-auto text-sm text-muted-foreground">Saved.</span>}
      {draft.dirty && (
        <ConfirmDialog
          trigger={<Button variant="outline" disabled={pending}>Discard changes</Button>}
          title="Discard your changes?"
          description="The definition and team go back to the saved investigation."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          destructive
          onConfirm={onDiscard}
        />
      )}
      <Button disabled={!draft.editable || !draft.dirty || draft.form.title.trim() === '' || pending} onClick={onSave} data-testid="save-case">
        Save investigation
      </Button>
    </div>
  );
}

function BackToOverview() {
  const { basePath } = useCaseWorkspace();
  const { search } = useLocation();
  return (
    <Link to={`${basePath}${search}`} className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
      <UiIcon.previous aria-hidden="true" className="h-4 w-4" />
      Back to overview
    </Link>
  );
}

/** The definition uses the original scalar command; status remains a separate workflow action. */
export function DefinitionPage() {
  const { rca, readOnly } = useCaseWorkspace();
  const { timezone } = useRcaFormat();
  const patch = useCasePatch();
  const draft = useDefinitionDraft(rca, timezone, !readOnly);
  const [saved, setSaved] = useState(false);
  const teamLocked = TEAM_LOCKED_STATUSES.includes(rca.status ?? '');
  const change: typeof draft.change = (next) => { setSaved(false); draft.change(next); };
  const discard = () => { draft.reset(); patch.reset(); setSaved(false); };
  const save = async () => {
    const result = await patch.save(buildDefinitionPatch(draft.form, draft.timezone), draft.rowVersion).catch(() => null);
    if (result) { draft.reset(result); setSaved(true); }
  };
  return (
    <div className="space-y-4" data-testid="case-definition-page">
      <BackToOverview />
      <DefinitionDraftNotice draft={draft} />
      <CaseCard title="Investigation definition" info={DEFINITION_INFO}>
        <DefinitionFields form={draft.form} onChange={change} readOnly={!draft.editable} disabled={patch.isPending} />
      </CaseCard>
      <CaseCard title="Team" info={teamLocked ? TEAM_LOCKED_INFO : 'Team lead and members, picked from the plant’s active users.'}>
        <TeamEditor value={draft.form} onChange={change} readOnly={!draft.editable || teamLocked} disabled={patch.isPending} />
      </CaseCard>
      {patch.error && <FriendlyErrorAlert error={patch.error} />}
      {!readOnly && <SaveBar draft={draft} pending={patch.isPending} saved={saved} onSave={() => void save()} onDiscard={discard} />}
    </div>
  );
}
