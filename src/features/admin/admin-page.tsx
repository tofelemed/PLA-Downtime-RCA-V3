import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { StatusRulesMoved } from '@/features/codes-admin/status-rules-moved';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { PageGate } from './shared/page-gate';

const PlantsSection = lazy(() => import('./plants/plants-section').then((m) => ({ default: m.PlantsSection })));
const AttributeDefinitionsPanel = lazy(() => import('./attributes/attribute-definitions-panel').then((m) => ({ default: m.AttributeDefinitionsPanel })));
const DashboardConfigSection = lazy(() => import('./dashboard/dashboard-config-section').then((m) => ({ default: m.DashboardConfigSection })));
const BrandingSection = lazy(() => import('./branding/branding-section').then((m) => ({ default: m.BrandingSection })));

type AdminTab = 'plants' | 'attributes' | 'dashboard' | 'branding' | 'automation';

interface TabSpec {
  value: AdminTab;
  label: string;
  /** shown to super administrators only (application-wide settings) */
  superAdminOnly?: boolean;
}

const TABS: readonly TabSpec[] = [
  { value: 'plants', label: 'Plants & organizations' },
  { value: 'attributes', label: 'Custom attributes' },
  { value: 'dashboard', label: 'Dashboard settings' },
  { value: 'branding', label: 'Branding', superAdminOnly: true },
  { value: 'automation', label: 'Status automation' },
];

function TabBody({ tab }: { tab: AdminTab }) {
  if (tab === 'plants') return <PlantsSection />;
  if (tab === 'attributes') return <AttributeDefinitionsPanel />;
  if (tab === 'dashboard') return <DashboardConfigSection />;
  if (tab === 'branding') return <BrandingSection />;
  return <StatusRulesMoved />;
}

/**
 * Admin panel (owner requirement "v2 only"): five sections, the active one in the URL (`?tab=`). Users moved
 * to Users (`/users`), units and assets to Master data; branding is application-wide (super administrators).
 */
export function AdminPage() {
  const { canUseAdminPanel } = useCapabilities();
  return (
    <PageGate title="Admin panel" allowed={canUseAdminPanel} deniedText="You don't have permission to access the admin panel.">
      <AdminScreen />
    </PageGate>
  );
}

function AdminScreen() {
  const { isSuperAdmin } = useCapabilities();
  const [params, setParams] = useSearchParams();
  const tabs = TABS.filter((tab) => !tab.superAdminOnly || isSuperAdmin);
  const requested = params.get('tab');
  const active = tabs.find((tab) => tab.value === requested)?.value ?? 'plants';
  const select = (value: string) =>
    setParams((current) => {
      const next = new URLSearchParams();
      next.set('tab', value);
      if (value === 'attributes' && current.get('level')) next.set('level', current.get('level') as string);
      return next;
    });
  return (
    <Page width="wide">
      <PageHeader title="Admin panel" description="Plants and organizations, custom attributes, dashboard settings and branding." />
      <Tabs value={active} onValueChange={select}>
        <TabsList className="h-auto flex-wrap justify-start">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={active} className="mt-6 space-y-6">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <TabBody tab={active} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
