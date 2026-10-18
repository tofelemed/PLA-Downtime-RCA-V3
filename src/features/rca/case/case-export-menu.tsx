import { useState } from 'react';
import { useRcaActions, useRcaCauses, useRcaLinks, useRcaOutcome } from '@/api/v2/queries/rca-cases';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAssetNames, useUserNames } from '@/features/ux-kit/labels';
import { ActionIcon } from '@/lib/icons';
import { caseJson, downloadText, evidenceCsv, exportName, recommendationsCsv, type CaseExportRecords } from '../model/case-export';
import { useRcaFormat } from '../use-rca-format';
import { useUnitNames } from '../use-unit-names';
import { useCaseWorkspace } from './case-context';

/** The case's actions, causes, links and outcome, read only once the export menu has been opened. */
function useExportRecords(rcaId: string, armed: boolean): CaseExportRecords | null {
  const id = armed ? rcaId : null;
  const actions = useRcaActions(id);
  const causes = useRcaCauses(id);
  const links = useRcaLinks(id);
  const outcome = useRcaOutcome(id);
  if (!actions.data || !causes.data || !links.data || outcome.isPending) return null;
  return { actions: actions.data, causes: causes.data, links: links.data, outcome: outcome.data ?? null };
}

/** Investigation (JSON with actions, causes, links, closure and outcome), evidence and recommendations (CSV), link. */
export function CaseExportMenu() {
  const { rca } = useCaseWorkspace();
  const [armed, setArmed] = useState(false);
  const records = useExportRecords(rca.id, armed);
  const users = useUserNames();
  const assets = useAssetNames();
  const { unitName } = useUnitNames();
  const { timezone } = useRcaFormat();
  const names = { user: users.nameOf, asset: assets.nameOf, unit: unitName };
  const copyLink = () => void navigator.clipboard?.writeText(window.location.href.split('?')[0]);
  const exportJson = () => {
    if (records) downloadText(caseJson(rca, names, records, timezone), exportName(rca, 'case.json'), 'application/json');
  };
  return (
    <DropdownMenu onOpenChange={(open) => open && setArmed(true)}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <ActionIcon.export aria-hidden="true" className="mr-1 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!records} onSelect={exportJson} data-testid="export-case-json">
          {records ? 'Investigation (JSON)' : 'Investigation (JSON) · loading…'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadText(evidenceCsv(rca, names), exportName(rca, 'evidence.csv'), 'text/csv')}>Evidence (CSV)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadText(recommendationsCsv(rca, names, timezone), exportName(rca, 'recommendations.csv'), 'text/csv')}>
          Recommendations (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={copyLink}>Copy link to this investigation</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
