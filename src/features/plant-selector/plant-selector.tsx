import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { usePlantSelection, type PlantSelection } from '@/contexts/PlantSelectionContext';
import { defaultTenantFor } from '@/contexts/plant-selection-store';
import { EntityIcon, UiIcon, type AppIcon } from '@/lib/icons';
import type { DirectoryOrganization as Organization } from '@/api/v2/types/plant-directory';
import { PlantTree } from './plant-tree';
import { usePlantDirectory } from './use-plant-directory';

interface Crumb {
  icon: AppIcon;
  name: string;
}

/** Breadcrumb of the selection (an asset shows its unit path, as before). */
function crumbsOf(selection: PlantSelection | null, organizations: readonly Organization[]): Crumb[] {
  if (!selection) return [];
  const tenant = selection.tenant;
  const org = selection.organization ?? organizations.find((entry) => entry.id === tenant?.organizationId);
  const crumbs: Crumb[] = [];
  if (org) crumbs.push({ icon: EntityIcon.organization, name: org.name });
  if (tenant) crumbs.push({ icon: EntityIcon.plant, name: tenant.name });
  if (selection.unit) crumbs.push({ icon: EntityIcon.unit, name: selection.unit.name });
  return crumbs;
}

/** Picks the user's default plant once, after the saved selection has loaded (never writes on every load). */
function useDefaultSelection(directory: ReturnType<typeof usePlantDirectory>) {
  const { session } = useAuth();
  const { selection, setSelection, loading } = usePlantSelection();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || loading || directory.isLoading || !session) return;
    if (selection?.tenant || selection?.unit || selection?.asset || directory.tenants.length === 0) return;
    done.current = true;
    const tenant = defaultTenantFor(session.user, directory.tenants);
    if (!tenant) return;
    const organization = directory.organizations.find((org) => org.id === tenant.organizationId);
    setSelection({ organization, tenant });
  }, [directory, loading, selection, session, setSelection]);
}

/**
 * Header plant selector: the scope every screen acts on. Loads only organisations and selectable
 * plants up front; units and assets load when a node is opened. Fully keyboard operable.
 */
export function PlantSelector() {
  const directory = usePlantDirectory();
  const { selection, setSelection, loading } = usePlantSelection();
  const [open, setOpen] = useState(false);
  useDefaultSelection(directory);

  if (loading || directory.isLoading) return <Skeleton className="h-5 w-40" role="status" aria-label="Loading plants" />;
  const crumbs = crumbsOf(selection, directory.organizations);
  const choose = (next: PlantSelection) => {
    setSelection(next);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full max-w-[28rem] gap-1 px-2" aria-label={`Plant: ${crumbs.map((c) => c.name).join(' › ') || 'none selected'}. Change plant`}>
          {crumbs.length === 0 && <span className="text-muted-foreground">Select plant and unit</span>}
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.name}-${index}`} className={`${index < crumbs.length - 1 ? 'hidden sm:flex' : 'flex'} min-w-0 items-center gap-1 text-sm font-medium`}>
              {index > 0 && <UiIcon.chevronRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden />}
              <crumb.icon className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
              <span className="max-w-[9rem] truncate" data-testid={index === crumbs.length - 1 ? 'plant-current-label' : undefined}>{crumb.name}</span>
            </span>
          ))}
          <UiIcon.chevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[400px] min-w-[340px] overflow-y-auto p-2">
        <PlantTree organizations={directory.organizations} tenants={directory.tenants} selection={selection} onSelect={choose} />
      </PopoverContent>
    </Popover>
  );
}
