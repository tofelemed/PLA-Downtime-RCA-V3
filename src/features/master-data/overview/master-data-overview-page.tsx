import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import { EntityIcon, type AppIcon } from '@/lib/icons';
import type { MasterDataSummaryView } from '../api/master-data-types';
import { useMasterDataSummary } from '../api/use-master-data-summary';
import { MasterDataLayout } from '../components/master-data-layout';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ReachablePagesOverview } from './reachable-pages-overview';

interface Tile {
  to: string;
  title: string;
  text: string;
  icon: AppIcon;
  count: keyof MasterDataSummaryView;
}

const PLANT_TILES: readonly Tile[] = [
  { to: '/master-data/units', title: 'Production units', text: 'Production units and lines of this plant', icon: EntityIcon.unit, count: 'units' },
  { to: '/master-data/assets', title: 'Assets', text: 'Equipment and instruments, each under a unit', icon: EntityIcon.asset, count: 'assets' },
  { to: '/master-data/products', title: 'Products', text: 'Shared by the organization or kept to this plant', icon: EntityIcon.product, count: 'products' },
];

const RCA_TILES: readonly Tile[] = [
  { to: '/master-data/rca/templates', title: 'RCA templates', text: 'Logic trees and the checklists they ask for', icon: EntityIcon.rcaCase, count: 'rcaTemplates' },
  { to: '/master-data/rca/causes', title: 'Cause library', text: 'Causes by category, as a tree', icon: EntityIcon.library, count: 'rcaCauses' },
  { to: '/master-data/rca/checklists', title: 'Verification checklists', text: 'Checks that confirm a fix worked', icon: EntityIcon.task, count: 'verificationChecklists' },
];

function TileGrid({ tiles, summary, loading }: { tiles: readonly Tile[]; summary?: MasterDataSummaryView; loading: boolean }) {
  const { number } = useNumberFormat();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile) => (
        <li key={tile.to}>
          <Link to={tile.to} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{tile.title}</CardTitle>
                <tile.icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-1">
                {loading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-semibold tabular-nums">
                    {number(summary?.[tile.count])}
                    <span className="sr-only"> active</span>
                  </p>
                )}
                <p className="text-sm text-muted-foreground">{tile.text}</p>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * `/master-data`: active record counts of the selected plant and the way into each section; a user who
 * only writes some reliability pages gets the list of those pages instead.
 */
export function MasterDataOverviewPage() {
  const { canManageMasterData } = useCapabilities();
  return canManageMasterData ? <PlantRecordsOverview /> : <ReachablePagesOverview />;
}

function PlantRecordsOverview() {
  const summary = useMasterDataSummary();
  return (
    <MasterDataLayout title="Master data" description="Reference data of the selected plant: units, assets, products and RCA settings.">
      {summary.isError && <FriendlyErrorAlert error={summary.error} onRetry={() => void summary.refetch()} />}
      <Section title="Equipment setup" description="Start here for one extruder or production unit, from plant records through its first approved period."><Link className="underline font-medium" to="/equipment-setup">Open step-by-step equipment setup</Link></Section>
      <Section title="Plant records" description="Active records; retired ones stay in history and can be restored.">
        <TileGrid tiles={PLANT_TILES} summary={summary.data} loading={summary.isLoading} />
      </Section>
      <Section title="RCA settings">
        <TileGrid tiles={RCA_TILES} summary={summary.data} loading={summary.isLoading} />
      </Section>
      <Section title="Hierarchy and code libraries">
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>
            <Link className="underline" to="/master-data/hierarchy">Plant hierarchy</Link> — organization, plants, units and assets as a tree.
          </li>
          <li>
            <Link className="underline" to="/master-data/codes-rules">Codes & rules</Link> — reason, impact and OEE codes, loss categories and rules.
          </li>
        </ul>
      </Section>
    </MasterDataLayout>
  );
}
