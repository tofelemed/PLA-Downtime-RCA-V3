import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
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
  const [tab] = useUrlParam<AdminTab>('tab', TABS, 'codes');
  return (
    <MasterDataLayout alsoAllowed={canViewOperations}
          title="Codes & rules"
          description={`Code libraries and automatic rules of this plant. Every change is kept as a version. Times in ${timezone}${utcFallback ? ' (no plant timezone set)' : ''}.`}
        >
      {/* the lists are tabs of the area's one tab row (Code libraries · Rules · Failure dictionary), no nested tabs */}
      <div className="space-y-6" data-testid="codes-admin" data-tab={tab}>
        {tab === 'rules' ? <RulesPanel /> : <CodeLibraryBrowser />}
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
