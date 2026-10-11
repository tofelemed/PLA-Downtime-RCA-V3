import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useProfiles } from '@/api/v2/queries/profiles';
import type { ProfileView } from '@/api/v2/types/profiles';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { FormField } from '../components/form-field';
import { LoadMore } from '../components/load-more';
import { NativeSelect } from '../components/native-select';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { ProfileDetail } from './profile-detail';
import { ProfileEditorDialog } from './profile-editor-dialog';
import { ProfileList } from './profile-list';
import { RateImportDialog } from './rate-import-dialog';

/**
 * Production profiles (plan 3.4 step 1, PLAN01/06): what a unit can make of a product, with effective-dated
 * rates and valuation rates, drafts, approvals and imports — everything validated and decided by the API.
 */
export function ProfilesTab() {
  const { canWriteProfiles, canApproveProfiles } = useCapabilities();
  const refs = usePlanningRefs();
  const [unitId, setUnitId] = useState('');
  const [productId, setProductId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ profile?: ProfileView } | null>(null);
  const [importing, setImporting] = useState(false);
  const profiles = useProfiles({ unitId: unitId || undefined, productId: productId || undefined });
  const items = flattenPages(profiles.data?.pages);
  const selected = items.find((profile) => profile.id === selectedId) ?? null;
  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]" data-testid="profiles-tab">
      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {canWriteProfiles && (
            <Button size="sm" onClick={() => setEditor({})} data-testid="profile-new">
              New profile
            </Button>
          )}
          {canApproveProfiles && (
            <Button size="sm" variant="outline" onClick={() => setImporting(true)} data-testid="rate-import">
              Import rates
            </Button>
          )}
          <ReadOnlyHint />
        </div>
        <FormField id="profileUnitFilter" label="Unit">
          <NativeSelect id="profileUnitFilter" value={unitId} options={refs.unitOptions} placeholder="All units" onChange={setUnitId} />
        </FormField>
        <FormField id="profileProductFilter" label="Product">
          <NativeSelect id="profileProductFilter" value={productId} options={refs.productOptions} placeholder="All products" onChange={setProductId} />
        </FormField>
        <DataState state={dataStateOf(profiles, { isEmpty: items.length === 0 })} error={profiles.error} detail="No profiles for this filter.">
          <ProfileList profiles={items} selectedId={selectedId} refs={refs} onSelect={setSelectedId} />
          <LoadMore hasNextPage={profiles.hasNextPage} isFetchingNextPage={profiles.isFetchingNextPage} fetchNextPage={profiles.fetchNextPage} />
        </DataState>
      </section>
      <section>
        {selected ? (
          <ProfileDetail profile={selected} refs={refs} onEdit={() => setEditor({ profile: selected })} />
        ) : (
          <p className="text-sm text-muted-foreground">Select a profile to see its rates, valuation rates and approvals.</p>
        )}
      </section>
      <ProfileEditorDialog
        open={editor}
        refs={refs}
        onClose={() => setEditor(null)}
        onSaved={(saved) => {
          setEditor(null);
          setSelectedId(saved.id);
        }}
      />
      <RateImportDialog open={importing} timezone={refs.timezone} onClose={() => setImporting(false)} />
    </div>
  );
}
