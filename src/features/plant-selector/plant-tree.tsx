import { useState } from 'react';
import type { PlantSelection } from '@/contexts/PlantSelectionContext';
import { EntityIcon } from '@/lib/icons';
import type { DirectoryOrganization as Organization, DirectoryPlant as Tenant, DirectoryUnit as Unit } from '@/api/v2/types/plant-directory';
import { TreeRow } from './tree-row';
import { usePlantUnits, useUnitAssets } from './use-plant-directory';

export interface PlantTreeProps {
  organizations: readonly Organization[];
  tenants: readonly Tenant[];
  selection: PlantSelection | null;
  onSelect: (selection: PlantSelection) => void;
}

type Expanded = ReadonlySet<string>;

function useExpanded(initial: readonly string[]) {
  const [expanded, setExpanded] = useState<Expanded>(() => new Set(initial));
  const toggle = (key: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return { isOpen: (key: string) => expanded.has(key), toggle };
}

function Notice({ level, text }: { level: number; text: string }) {
  return (
    <li className="py-1 text-xs text-muted-foreground" style={{ paddingLeft: level * 16 + 32 }}>
      {text}
    </li>
  );
}

interface NodeProps {
  selection: PlantSelection | null;
  onSelect: (selection: PlantSelection) => void;
  isOpen: (key: string) => boolean;
  toggle: (key: string) => void;
}

function UnitNode({ org, tenant, unit, ...tree }: NodeProps & { org: Organization; tenant: Tenant; unit: Unit }) {
  const key = `unit:${unit.id}`;
  const open = tree.isOpen(key);
  const assets = useUnitAssets(tenant.id, unit, open);
  const selected = tree.selection?.unit?.id === unit.id && !tree.selection?.asset;
  return (
    <TreeRow level={2} icon={EntityIcon.unit} label={unit.name} selected={selected} expandable expanded={open}
      onToggle={() => tree.toggle(key)} onSelect={() => tree.onSelect({ organization: org, tenant, unit })}>
      {assets.isLoading && <Notice level={3} text="Loading assets…" />}
      {assets.data?.length === 0 && <Notice level={3} text="No assets" />}
      {assets.data?.map((asset) => (
        <TreeRow key={asset.id} level={3} icon={EntityIcon.asset} label={asset.name} selected={tree.selection?.asset?.id === asset.id}
          expandable={false} expanded={false} onToggle={() => undefined}
          onSelect={() => tree.onSelect({ organization: org, tenant, unit, asset })} />
      ))}
    </TreeRow>
  );
}

function TenantNode({ org, tenant, ...tree }: NodeProps & { org: Organization; tenant: Tenant }) {
  const key = `tenant:${tenant.id}`;
  const open = tree.isOpen(key);
  const units = usePlantUnits(tenant.id, open);
  const selected = tree.selection?.tenant?.id === tenant.id && !tree.selection?.unit && !tree.selection?.asset;
  return (
    <TreeRow level={1} icon={EntityIcon.plant} label={tenant.name} selected={selected} expandable expanded={open}
      onToggle={() => tree.toggle(key)} onSelect={() => tree.onSelect({ organization: org, tenant })}>
      {units.isLoading && <Notice level={2} text="Loading units…" />}
      {units.data?.length === 0 && <Notice level={2} text="No units" />}
      {units.data?.map((unit) => <UnitNode key={unit.id} org={org} tenant={tenant} unit={unit} {...tree} />)}
    </TreeRow>
  );
}

/**
 * Organisation → plant → unit → asset tree of the plant selector. Units and assets load when their
 * parent is expanded; the selected plant's organisation and plant start expanded.
 */
export function PlantTree({ organizations, tenants, selection, onSelect }: PlantTreeProps) {
  const initial = [selection?.organization?.id ?? selection?.tenant?.organizationId, selection?.tenant?.id]
    .filter((id): id is string => Boolean(id));
  const { isOpen, toggle } = useExpanded([`org:${initial[0] ?? ''}`, `tenant:${initial[1] ?? ''}`]);
  const tree = { selection, onSelect, isOpen, toggle };
  return (
    <ul aria-label="Plants" className="text-sm">
      {organizations.map((org) => {
        const key = `org:${org.id}`;
        const orgTenants = tenants.filter((tenant) => tenant.organizationId === org.id);
        const selected = tree.selection?.organization?.id === org.id && !selection?.tenant;
        return (
          <TreeRow key={org.id} level={0} icon={EntityIcon.organization} label={org.name} selected={selected}
            expandable={orgTenants.length > 0} expanded={isOpen(key)} onToggle={() => toggle(key)}
            onSelect={() => onSelect({ organization: org })}>
            {orgTenants.map((tenant) => <TenantNode key={tenant.id} org={org} tenant={tenant} {...tree} />)}
          </TreeRow>
        );
      })}
    </ul>
  );
}
