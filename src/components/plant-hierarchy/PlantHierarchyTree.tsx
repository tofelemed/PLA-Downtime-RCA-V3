import React, { useEffect, useMemo, useState } from 'react';
import { masterDataService, Organization as AppOrg, Tenant as AppTenant, Unit as AppUnit, Asset as AppAsset } from '@/services/MasterDataService';
import { piStore } from '@/services/pi/PIStore';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Building2, Factory, Settings, Package, ChevronRight, ChevronDown, Database } from 'lucide-react';

type NodeKind = 'org' | 'tenant' | 'unit' | 'asset';

export default function PlantHierarchyTree() {
  const [orgs, setOrgs] = useState<AppOrg[]>([]);
  const [tenants, setTenants] = useState<AppTenant[]>([]);
  const [units, setUnits] = useState<AppUnit[]>([]);
  const [assets, setAssets] = useState<AppAsset[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bindingsByTenant, setBindingsByTenant] = useState<Record<string, any[]>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const [o, t, u, a] = await Promise.all([
        masterDataService.getOrganizations(),
        masterDataService.getTenants({}),
        masterDataService.getUnits({}),
        masterDataService.getAssets({}),
      ]);
      setOrgs(o); setTenants(t); setUnits(u); setAssets(a);
    })();
  }, []);

  const unitsByTenant = useMemo(() => {
    const map: Record<string, AppUnit[]> = {};
    for (const u of units) {
      if (!map[u.tenantId]) map[u.tenantId] = [];
      map[u.tenantId].push(u);
    }
    return map;
  }, [units]);

  const assetsByUnit = useMemo(() => {
    const map: Record<string, AppAsset[]> = {};
    for (const a of assets) {
      if (!map[a.unitId]) map[a.unitId] = [];
      map[a.unitId].push(a);
    }
    return map;
  }, [assets]);

  const filtered = (name: string) => !search || name.toLowerCase().includes(search.toLowerCase());

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const ensureTenantBindings = async (tenantId: string) => {
    if (bindingsByTenant[tenantId]) return;
    const list = await piStore.listBindings(tenantId);
    setBindingsByTenant(prev => ({ ...prev, [tenantId]: list }));
  };

  const PIbadge = ({ tenantId, kind, localId }: { tenantId: string; kind: 'unit'|'asset'; localId: string }) => {
    const list = bindingsByTenant[tenantId] || [];
    const bound = list.filter((b: any) => b.boundType === kind && b.localId === localId);
    if (bound.length === 0) return null;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-2 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 inline-flex items-center gap-1">
              <Database className="w-3 h-3"/> PI
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[420px] break-all">
            {bound.slice(0,3).map((b: any) => (<div key={b.id} className="text-xs">{b.webId}</div>))}
            {bound.length > 3 && (<div className="text-[11px] text-muted-foreground">+{bound.length - 3} more…</div>)}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const TenantNode: React.FC<{ t: AppTenant }> = ({ t }) => {
    const id = `tenant:${t.id}`;
    const isOpen = !!expanded[id];
    const children = (unitsByTenant[t.id] || []).filter(u => filtered(u.name) || filtered(u.code));
    return (
      <div>
        <div className="group flex items-center gap-2 py-1 px-2 rounded-md hover:bg-blue-50">
          <button className="p-1 rounded hover:bg-blue-100 text-blue-700" onClick={async () => { toggle(id); await ensureTenantBindings(t.id); }}>
            {isOpen ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
          </button>
          <Factory className="w-4 h-4 text-emerald-600"/>
          <span className="text-sm font-medium text-slate-800 truncate">{t.name}</span>
        </div>
        {isOpen && (
          <div>
            {children.map(u => <UnitNode key={u.id} u={u} tenantId={t.id} level={1}/>) }
          </div>
        )}
      </div>
    );
  };

  const UnitNode: React.FC<{ u: AppUnit; tenantId: string; level: number }> = ({ u, tenantId, level }) => {
    const id = `unit:${u.id}`;
    const isOpen = !!expanded[id];
    const children = (assetsByUnit[u.id] || []).filter(a => filtered(a.name) || filtered(a.code));
    return (
      <div>
        <div className="group flex items-center gap-2 py-1 px-2 rounded-md hover:bg-blue-50" style={{ paddingLeft: level * 16 }}>
          <button className="p-1 rounded hover:bg-blue-100 text-blue-700" onClick={() => toggle(id)}>
            {isOpen ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
          </button>
          <Settings className="w-4 h-4 text-orange-600"/>
          <span className="text-sm font-medium text-slate-800 truncate">{u.name}</span>
          <PIbadge tenantId={tenantId} kind="unit" localId={u.id} />
        </div>
        {isOpen && children.map(a => <AssetNode key={a.id} a={a} tenantId={tenantId} level={level+1} />)}
      </div>
    );
  };

  const AssetNode: React.FC<{ a: AppAsset; tenantId: string; level: number }> = ({ a, tenantId, level }) => (
    <div className="group flex items-center gap-2 py-1 px-2 rounded-md hover:bg-blue-50" style={{ paddingLeft: level * 16 }}>
      <Package className="w-4 h-4 text-purple-600"/>
      <span className="text-sm text-slate-800 truncate">{a.name}</span>
      <PIbadge tenantId={tenantId} kind="asset" localId={a.id} />
    </div>
  );

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm"/>
      </div>
      <div className="border rounded max-h-[560px] overflow-auto bg-white/70">
        {orgs.filter(o => filtered(o.name) || filtered(o.code)).map(org => (
          <div key={org.id}>
            <div className="group flex items-center gap-2 py-1 px-2 rounded-md hover:bg-blue-50">
              <Building2 className="w-4 h-4 text-sky-600"/>
              <span className="text-sm font-semibold text-slate-900">{org.name}</span>
            </div>
            <div>
              {tenants.filter(t => t.organizationId === org.id && (filtered(t.name) || filtered(t.code))).map(t => (
                <div key={t.id} style={{ paddingLeft: 16 }}>
                  <TenantNode t={t} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

