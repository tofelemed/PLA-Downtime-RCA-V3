import { useState } from 'react';
import { useRcaActions, useRcaAnalyses, useRcaCauses, useRcaLinks, useRcaOutcome } from '@/api/v2/queries/rca-cases';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { useAssetNames, useUserNames } from '@/features/ux-kit/labels';
import { ActionIcon } from '@/lib/icons';
import { actionsCsv, caseJson, downloadText, evidenceCsv, exportName, recommendationsCsv, type CaseExportRecords } from '../model/case-export';
import { fetchCaseHistory, historyExportRow } from '../model/history-export';
import { useRcaFormat } from '../use-rca-format';
import { useUnitNames } from '../use-unit-names';
import { useCaseWorkspace } from './case-context';
import { useCopyCaseLink } from './use-copy-case-link';
import { useHistoryResolvers } from './history/use-history-resolvers';

type LoadedRecords = Omit<CaseExportRecords, 'history'>;

/** The case's actions, causes, links, outcome and analyses, read only once the export menu has been opened. */
function useExportRecords(rcaId: string, armed: boolean): LoadedRecords | null {
  const id = armed ? rcaId : null;
  const actions = useRcaActions(id);
  const causes = useRcaCauses(id);
  const links = useRcaLinks(id);
  const outcome = useRcaOutcome(id);
  const analyses = useRcaAnalyses(id);
  if (!actions.data || !causes.data || !links.data || outcome.isPending || analyses.isPending) return null;
  return { actions: actions.data, causes: causes.data, links: links.data, outcome: outcome.data ?? null, analyses: analyses.data ?? null };
}

/**
 * Investigation (JSON with analyses, actions, causes, links, closure, outcome and History), evidence,
 * recommendations and actions (CSV), and Copy link (with a toast either way).
 */
export function CaseExportMenu() {
  const { rca } = useCaseWorkspace();
  const [armed, setArmed] = useState(false);
  const records = useExportRecords(rca.id, armed);
  const users = useUserNames();
  const assets = useAssetNames();
  const { unitName } = useUnitNames();
  const { timezone, dateTime } = useRcaFormat();
  const resolve = useHistoryResolvers(armed);
  const { toast } = useToast();
  const copyLink = useCopyCaseLink();
  const names = { user: users.nameOf, asset: assets.nameOf, unit: unitName };
  const exportJson = async () => {
    if (!records) return;
    try {
      const history = (await fetchCaseHistory(rca.id)).map((entry) => historyExportRow(entry, resolve));
      downloadText(caseJson(rca, names, { ...records, history }, timezone), exportName(rca, 'case.json'), 'application/json');
    } catch (error) {
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
    }
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
        <DropdownMenuItem disabled={!records} onSelect={() => void exportJson()} data-testid="export-case-json">
          {records ? 'Investigation (JSON)' : 'Investigation (JSON) · loading…'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadText(evidenceCsv(rca, names, dateTime), exportName(rca, 'evidence.csv'), 'text/csv')}>Evidence (CSV)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadText(recommendationsCsv(rca, names, timezone), exportName(rca, 'recommendations.csv'), 'text/csv')}>
          Recommendations (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!records}
          onSelect={() => records && downloadText(actionsCsv(rca, records.actions, names, timezone), exportName(rca, 'actions.csv'), 'text/csv')}
          data-testid="export-actions-csv"
        >
          {records ? 'Actions (CSV)' : 'Actions (CSV) · loading…'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copyLink()} data-testid="copy-case-link">
          Copy link to this investigation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
