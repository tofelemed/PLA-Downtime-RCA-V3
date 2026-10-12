import { useNavigate } from 'react-router-dom';
import { useDeleteRcaCase } from '@/api/v2/queries/rca-commands';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAssetNames, useUserNames } from '@/features/ux-kit/labels';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { caseJson, downloadText, evidenceCsv, exportName, recommendationsCsv } from '../model/case-export';
import { useRcaFormat } from '../use-rca-format';
import { useUnitNames } from '../use-unit-names';
import { useCaseWorkspace } from './case-context';

function ExportMenu() {
  const { rca } = useCaseWorkspace();
  const users = useUserNames();
  const assets = useAssetNames();
  const { unitName } = useUnitNames();
  const names = { user: users.nameOf, asset: assets.nameOf, unit: unitName };
  const copyLink = () => void navigator.clipboard?.writeText(window.location.href.split('?')[0]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <ActionIcon.export aria-hidden="true" className="mr-1 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => downloadText(caseJson(rca, names), exportName(rca, 'case.json'), 'application/json')}>
          Case (JSON)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadText(evidenceCsv(rca), exportName(rca, 'evidence.csv'), 'text/csv')}>Evidence (CSV)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadText(recommendationsCsv(rca, names), exportName(rca, 'recommendations.csv'), 'text/csv')}>
          Recommendations (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={copyLink}>Copy link to this case</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteCase() {
  const { rca } = useCaseWorkspace();
  const navigate = useNavigate();
  const remove = useDeleteRcaCase();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <ActionIcon.delete aria-hidden="true" className="mr-1 h-4 w-4" />
          Delete
        </Button>
      }
      title="Delete this case?"
      description="Only an open case without links, actions or recommendations from triggers can be deleted. Its analysis records go with it."
      confirmLabel="Delete case"
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

/** Title, status, priority, unit and dates of the case, with export and delete. */
export function CaseHeader() {
  const { rca, readOnly } = useCaseWorkspace();
  const { unitName } = useUnitNames();
  const { date, day } = useRcaFormat();
  const meta = (
    <span className="flex flex-wrap items-center gap-2">
      <Badge data-testid="case-status">{rca.status ?? 'Draft'}</Badge>
      <Badge variant="outline">{rca.priority ?? 'Medium'}</Badge>
      <span>{unitName(rca.unitId)}</span>
      <span>· opened {date(rca.createdAt)}</span>
      {rca.targetCloseDate && <span>· target {day(rca.targetCloseDate)}</span>}
      {rca.actualCloseDate && <span>· closed {date(rca.actualCloseDate)}</span>}
    </span>
  );
  return (
    <PageHeader
      title={rca.title}
      back={{ to: '/rca', label: 'RCA cases' }}
      meta={meta}
      actions={
        <>
          <ExportMenu />
          {!readOnly && <DeleteCase />}
        </>
      }
    />
  );
}
