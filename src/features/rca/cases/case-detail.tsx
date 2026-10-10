import { useRcaCase } from '@/api/v2/queries/rca-cases';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ActionsTab } from '../actions/actions-tab';
import { LinksTab } from '../links/links-tab';
import { OutcomePanel } from '../outcome-panel';
import { useUnitNames } from '../use-unit-names';
import { CaseEditor } from './case-editor';

/** One case: analysis (form and nested content), links with evidence, actions, outcome. */
export function CaseDetail({ id, timezone }: { id: string; timezone: string }) {
  const detail = useRcaCase(id);
  const { unitName } = useUnitNames();
  const rca = detail.data;
  return (
    <section className="space-y-3" aria-label="RCA case" data-testid="case-detail">
      <DataState state={dataStateOf(detail)} error={detail.error} onRetry={() => detail.refetch()}>
        {rca && (
          <>
            <header className="space-y-1">
              <h2 className="text-xl font-semibold" data-testid="case-title">{rca.title}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge data-testid="case-status">{rca.status ?? '—'}</Badge>
                <Badge variant="outline">{rca.priority ?? '—'}</Badge>
                <span>{unitName(rca.unitId)}</span>
                <span>· opened <PlantTime iso={rca.createdAt} tz={timezone} withDate /></span>
                {rca.actualCloseDate && <span>· closed <PlantTime iso={rca.actualCloseDate} tz={timezone} withDate /></span>}
              </div>
            </header>
            <Tabs defaultValue="analysis">
              <TabsList className="flex-wrap">
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="links" data-testid="tab-links">Links</TabsTrigger>
                <TabsTrigger value="actions" data-testid="tab-actions">Actions</TabsTrigger>
                <TabsTrigger value="outcome" data-testid="tab-outcome">Outcome</TabsTrigger>
              </TabsList>
              <TabsContent value="analysis"><CaseEditor rca={rca} /></TabsContent>
              <TabsContent value="links"><LinksTab rcaId={rca.id} timezone={timezone} /></TabsContent>
              <TabsContent value="actions"><ActionsTab rcaId={rca.id} timezone={timezone} /></TabsContent>
              <TabsContent value="outcome"><OutcomePanel rcaId={rca.id} /></TabsContent>
            </Tabs>
          </>
        )}
      </DataState>
    </section>
  );
}
