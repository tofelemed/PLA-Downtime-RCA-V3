import { useNavigate } from 'react-router-dom';
import { useRcaLinks } from '@/api/v2/queries/rca-cases';
import { useDeleteRcaCase } from '@/api/v2/queries/rca-commands';
import { Button } from '@/components/ui/button';
import { pageNameOf } from '@/features/auth/navigation-items';
import { PRIORITY_TONES, RCA_CASE_STATUS_TONES } from '@/features/ux-kit/labels';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { toneOf } from '@/features/ux-kit/status-tone';
import { ActionIcon } from '@/lib/icons';
import { statusLabel } from '../model/rca-labels';
import { useRcaFormat } from '../use-rca-format';
import { useUnitNames } from '../use-unit-names';
import { useCaseWorkspace } from './case-context';
import { CaseExportMenu } from './case-export-menu';
import { CaseExportPdf } from './case-export-pdf';
import { CaseTrace } from './case-trace';

/**
 * Delete, hidden when the server would refuse it for reasons on screen: a closed case or one with links
 * (the case view carries no link count, so the links list is read). Other refusals (actions, a case
 * opened from a recommendation) show the server's reason in the dialog.
 */
function DeleteCase() {
  const { rca } = useCaseWorkspace();
  const navigate = useNavigate();
  const remove = useDeleteRcaCase();
  const links = useRcaLinks(rca.id);
  if (rca.status === 'Closed' || (links.data?.length ?? 0) > 0) return null;
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <ActionIcon.delete aria-hidden="true" className="mr-1 h-4 w-4" />
          Delete
        </Button>
      }
      title="Delete this investigation?"
      description="Only an open investigation without links, actions or recommendations from triggers can be deleted. Its analysis records go with it."
      confirmLabel="Delete investigation"
      destructive
      onConfirm={async () => {
        await remove.submit(rca);
        navigate('/rca', { replace: true });
      }}
    >
      {remove.error ? <FriendlyErrorAlert error={remove.error} /> : null}
    </ConfirmDialog>
  );
}

/** Title, status, priority, unit and dates of the case, its trigger event and approved loss, with exports (PDF, files) and delete. */
export function CaseHeader() {
  const { rca, readOnly } = useCaseWorkspace();
  const { unitName } = useUnitNames();
  const { date, day } = useRcaFormat();
  const meta = (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={toneOf(RCA_CASE_STATUS_TONES, rca.status ?? 'Draft')} data-testid="case-status">{statusLabel(rca.status)}</StatusBadge>
        <StatusBadge tone={toneOf(PRIORITY_TONES, rca.priority ?? 'Medium')}>{rca.priority ?? 'Medium'}</StatusBadge>
        <span>{unitName(rca.unitId)}</span>
        <span>· opened {date(rca.createdAt)}</span>
        {rca.targetCloseDate && <span>· target {day(rca.targetCloseDate)}</span>}
        {rca.actualCloseDate && <span>· closed {date(rca.actualCloseDate)}</span>}
      </span>
      <CaseTrace />
    </span>
  );
  return (
    <PageHeader
      title={rca.title}
      back={{ to: '/rca', label: pageNameOf('/rca') }}
      meta={meta}
      actions={
        <>
          <CaseExportPdf />
          <CaseExportMenu />
          {!readOnly && <DeleteCase />}
        </>
      }
    />
  );
}
