import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { CodeLibraryPanel } from './codes/code-library-panel';
import { MappingRulesPanel } from './codes/mapping-rules-panel';
import { LIBRARIES } from './model/code-fields';
import { RulesPanel } from './rules/rules-panel';

const LIBRARY_TABS: readonly CodeLibraryPath[] = ['reason-codes', 'impact-codes', 'oee-codes', 'failure-code-groups', 'loss-category-defs'];

/**
 * Codes and declarative admin rules (plan 3.8) behind `v2.codesAdmin`: the plant's code libraries
 * (tenant-scoped, hierarchical, versioned, retire with impact, default mappings with preview) and the
 * server-side rule builder with simulation, versions and rollback.
 */
export function CodesAdminPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to manage its codes and rules." />;
  return <CodesAdminScreen />;
}

function CodesAdminScreen() {
  const { timezone, source } = usePlantTimezone();
  return (
    <div className="space-y-4" data-testid="codes-admin">
      <header>
        <h1 className="text-2xl font-bold">Codes &amp; rules</h1>
        <p className="text-sm text-muted-foreground">
          Code libraries and declarative rules of this plant only. Every change is a new version; times in {timezone}
          {source === 'utc-fallback' ? ' (no plant timezone configured)' : ''}.
        </p>
      </header>
      <Tabs defaultValue="reason-codes">
        <TabsList className="flex-wrap">
          {LIBRARY_TABS.map((library) => (
            <TabsTrigger key={library} value={library} data-testid={`tab-${library}`}>
              {LIBRARIES[library].label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="mapping-rules" data-testid="tab-mapping-rules">
            Default mappings
          </TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">
            Rules
          </TabsTrigger>
        </TabsList>
        {LIBRARY_TABS.map((library) => (
          <TabsContent key={library} value={library}>
            <CodeLibraryPanel library={library} />
          </TabsContent>
        ))}
        <TabsContent value="mapping-rules">
          <MappingRulesPanel />
        </TabsContent>
        <TabsContent value="rules">
          <RulesPanel timezone={timezone} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
