import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { MasterDataLayout } from '@/features/master-data/components/master-data-layout';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { CodeLibraryBrowser } from './codes/code-library-browser';
import { usePlantDates } from './hooks/use-plant-dates';
import { useUrlParam } from './hooks/use-url-param';
import { RulesPanel } from './rules/rules-panel';

const TABS = ['codes', 'rules'] as const;
type AdminTab = (typeof TABS)[number];

function CodesAdminScreen() {
  const { canViewOperations } = useCapabilities();
  const { timezone, utcFallback } = usePlantDates();
  const [tab, setTab] = useUrlParam<AdminTab>('tab', TABS, 'codes');
  return (
    <MasterDataLayout alsoAllowed={canViewOperations}
          title="Codes & rules"
          description={`Code libraries and automatic rules of this plant. Every change is kept as a version. Times in ${timezone}${utcFallback ? ' (no plant timezone set)' : ''}.`}
        >
      <div className="space-y-6" data-testid="codes-admin">
        <Tabs value={tab} onValueChange={(value) => setTab(value as AdminTab)}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="codes" data-testid="tab-codes">
              Code libraries
            </TabsTrigger>
            <TabsTrigger value="rules" data-testid="tab-rules">
              Rules
            </TabsTrigger>
          </TabsList>
          <TabsContent value="codes" className="pt-4">
            <CodeLibraryBrowser />
          </TabsContent>
          <TabsContent value="rules" className="pt-4">
            <RulesPanel />
          </TabsContent>
        </Tabs>
      </div>
    </MasterDataLayout>
  );
}

/**
 * Codes and declarative rules (plan 3.8) at `/master-data/codes-rules`: the plant's code libraries (tree, versions,
 * retire with impact, default mappings) and the server-side rule builder with simulation and versions.
 */
export function CodesAdminPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to manage its codes and rules." />;
  return <CodesAdminScreen />;
}
