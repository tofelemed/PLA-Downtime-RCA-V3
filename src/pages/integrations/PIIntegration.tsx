import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Database, Cloud, RefreshCw, ChevronRight, ChevronDown, Folder, FolderOpen, Box, Factory, Wrench, Copy, PlugZap, Wifi, WifiOff, Info, Hash, FileText } from 'lucide-react';
import { autoPIEventSyncService } from '@/services/pi/AutoPIEventSyncService';
import { PISyncService } from '@/services/pi/PISyncService';
import { HistorianClient } from '@/services/historian/HistorianClient';
import { PIHistorianProvider } from '@/services/historian/providers/pi/PIHistorianProvider';
import { HistorianQueryForm } from '@/components/historian/HistorianQueryForm';
import { TimeSeriesTable } from '@/components/historian/TimeSeriesTable';
import { TimeSeriesChart } from '@/components/historian/TimeSeriesChart';
import { useToast } from '@/hooks/use-toast';
import { PIClient, basicAuthHeader } from '@/services/pi/PIClient';
import { piStore } from '@/services/pi/PIStore';
import { defaultTemplateToEventType, defaultAttributesByTemplate } from '@/services/pi/PIMapper';
import { useAuth } from '@/contexts/AuthContext';
import { masterDataService, Unit as AppUnit, Asset as AppAsset, Organization as AppOrg, Tenant as AppTenant } from '@/services/MasterDataService';
import HistorianTagConfigurator from '@/components/historian/HistorianTagConfigurator';
import EnhancedHistorianPage from '@/components/historian/EnhancedHistorianPage';

export default function PIIntegration() {
  const { toast } = useToast();
  const { session } = useAuth();
  const [baseUrl, setBaseUrl] = useState('https://piv.hillal-intl.com:8070/piwebapi');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [autoDelta, setAutoDelta] = useState<boolean>(false);
  const [intervalSec, setIntervalSec] = useState<number>(300);
  const client = useMemo(() => {
    const tenantId = session?.tenant?.id;
    // Prefer backend-proxied PI calls (credentials stored encrypted server-side)
    if (tenantId) {
      return new PIClient({ tenantId });
    }
    if (username && password && baseUrl) {
      return new PIClient({
        baseUrl,
        authProvider: async () => basicAuthHeader(username, password),
      });
    }
    return null;
  }, [session?.tenant?.id, username, password, baseUrl]);
  const [assetServers, setAssetServers] = useState<any[]>([]);
  const [tab, setTab] = useState<string>('conn');
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [databases, setDatabases] = useState<any[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [rootElements, setRootElements] = useState<any[]>([]);
  const [selectedRoot, setSelectedRoot] = useState<string>('');
  const [scopeType, setScopeType] = useState<'element'|'database'>('element');
  const [children, setChildren] = useState<Record<string, any[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bindings, setBindings] = useState<Record<string, { type: 'unit'|'asset'; localId: string }>>({});
  const [efTemplates, setEfTemplates] = useState<string[]>(['All templates','Production Loss','IOW Deviation','SOL Violation','APM Alert','Failure WO','Production Output','*NoTemplate*']);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('Production Loss');
  const [timeStart, setTimeStart] = useState<string>(new Date(Date.now() - 3600*1000).toISOString());
  const [timeEnd, setTimeEnd] = useState<string>(new Date().toISOString());
  const [preview, setPreview] = useState<any[]>([]);
  const [efPage, setEfPage] = useState<number>(1);
  const [efHasNext, setEfHasNext] = useState<boolean>(false);
  const [efMaxVisited, setEfMaxVisited] = useState<number>(1);
  const [efLoading, setEfLoading] = useState<boolean>(false);
  const [efCache, setEfCache] = useState<Record<string, Record<number, any[]>>>({});
  const [efHasNextByPage, setEfHasNextByPage] = useState<Record<string, Record<number, boolean>>>({});
  const [piOnline, setPiOnline] = useState<'unknown'|'connected'|'disconnected'>('unknown');
  const [efEndpointOnline, setEfEndpointOnline] = useState<'unknown'|'connected'|'disconnected'>('unknown');
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('');

  const efKey = useMemo(() => {
    const scopeId = scopeType === 'element' ? selectedRoot : selectedDb;
    const tpl = selectedTemplate;
    return `${scopeType}:${scopeId}|${tpl}|${timeStart}|${timeEnd}`;
  }, [scopeType, selectedRoot, selectedDb, selectedTemplate, timeStart, timeEnd]);

  const fetchEfPage = async (pageNum: number) => {
    const isAll = selectedTemplate === 'All templates';
    const isNoTpl = selectedTemplate === '*NoTemplate*';
    const res = await client.getEventFrames({
      elementWebId: scopeType === 'element' ? selectedRoot : undefined,
      databaseWebId: scopeType === 'database' ? selectedDb : undefined,
      startTimeUtc: timeStart,
      endTimeUtc: timeEnd,
      templateName: isAll || isNoTpl ? undefined : selectedTemplate,
      maxCount: 10,
      startIndex: (pageNum - 1) * 10,
    });
    let items = res?.Items ?? [];
    if (isNoTpl) items = items.filter((ef: any) => !ef.TemplateName);
    const hasNext = ((res?.Links?.Next || '').length > 0) || (items.length || 0) === 10;
    // cache
    setEfCache(prev => ({ ...prev, [efKey]: { ...(prev[efKey] || {}), [pageNum]: items } }));
    setEfHasNextByPage(prev => ({ ...prev, [efKey]: { ...(prev[efKey] || {}), [pageNum]: hasNext } }));
    return { items, hasNext };
  };

  const checkConnectivity = async () => {
    try {
      await client.getAssetServers();
      setPiOnline('connected');
    } catch {
      setPiOnline('disconnected');
    }
    try {
      if (selectedDb) {
        await client.getEventFrames({ databaseWebId: selectedDb, startTimeUtc: new Date(Date.now()-60000).toISOString(), endTimeUtc: new Date().toISOString(), maxCount: 1, selectedFields: 'Items.WebId' });
        setEfEndpointOnline('connected');
      } else if (selectedRoot) {
        await client.getEventFrames({ elementWebId: selectedRoot, startTimeUtc: new Date(Date.now()-60000).toISOString(), endTimeUtc: new Date().toISOString(), maxCount: 1, selectedFields: 'Items.WebId' });
        setEfEndpointOnline('connected');
      } else {
        setEfEndpointOnline('unknown');
      }
    } catch {
      setEfEndpointOnline('disconnected');
    }
    setLastCheckedAt(new Date().toLocaleString());
  };

  useEffect(() => {
    if (!client) return;
    checkConnectivity();
    const timer = setInterval(checkConnectivity, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, selectedDb, selectedRoot]);

  // Auto-load asset servers when client becomes available
  useEffect(() => {
    if (client && assetServers.length === 0) {
      loadAssetServers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);
  const [templateToType, setTemplateToType] = useState<Record<string, string>>({ ...defaultTemplateToEventType, '*NoTemplate*': 'ProductionLoss' });
  const [attrTextByTemplate, setAttrTextByTemplate] = useState<Record<string, string>>(() => {
    const obj: Record<string, string> = {};
    for (const t of Object.keys(defaultAttributesByTemplate)) {
      obj[t] = JSON.stringify((defaultAttributesByTemplate as any)[t], null, 2);
    }
    if (!obj['*NoTemplate*']) obj['*NoTemplate*'] = JSON.stringify(defaultAttributesByTemplate['*NoTemplate*'] || { Description: 'description' }, null, 2);
    return obj;
  });
  const [stats, setStats] = useState<{ total: number; byTemplate: Record<string, number> }>({ total: 0, byTemplate: {} });
  const [lastWatermark, setLastWatermark] = useState<string>('');
  const [attrOptionsByTemplate, setAttrOptionsByTemplate] = useState<Record<string, string[]>>({});
  const [attrMapByTemplate, setAttrMapByTemplate] = useState<Record<string, Record<string, string>>>({});
  const [attrLoadingTpl, setAttrLoadingTpl] = useState<Record<string, boolean>>({});
  const [discoverLoading, setDiscoverLoading] = useState<boolean>(false);
  // Mapping manager modal
  const [manageOpen, setManageOpen] = useState(false);
  const [manageFilter, setManageFilter] = useState('');
  const [manageSelectedTpl, setManageSelectedTpl] = useState<string>('');
  // Dedicated Mapping time window (independent from EF tab)
  const [mappingStart, setMappingStart] = useState<string>(new Date(Date.now() - 24*3600*1000).toISOString());
  const [mappingEnd, setMappingEnd] = useState<string>(new Date().toISOString());
  // Mapping-specific scope controls
  const [mappingScopeType, setMappingScopeType] = useState<'element'|'database'>('database');
  const [mappingSelectedServer, setMappingSelectedServer] = useState<string>('');
  const [mappingDatabases, setMappingDatabases] = useState<any[]>([]);
  const [mappingSelectedDb, setMappingSelectedDb] = useState<string>('');
  const [mappingRootElements, setMappingRootElements] = useState<any[]>([]);
  const [mappingSelectedRoot, setMappingSelectedRoot] = useState<string>('');
  const [templateFilter, setTemplateFilter] = useState<string>('');

  // Ensure Edit modal shows saved mappings immediately by seeding attribute options
  useEffect(() => {
    if (!manageOpen || !manageSelectedTpl) return;
    const saved = attrMapByTemplate[manageSelectedTpl];
    if (saved && Object.keys(saved).length > 0) {
      setAttrOptionsByTemplate(prev => {
        const existing = new Set(prev[manageSelectedTpl] || []);
        for (const k of Object.keys(saved)) existing.add(k);
        return { ...prev, [manageSelectedTpl]: Array.from(existing) };
      });
    }
  }, [manageOpen, manageSelectedTpl, attrMapByTemplate]);

  const toIsoOrThrow = (value: string, label: string): string => {
    try {
      if (!value) throw new Error(`${label} is empty`);
      // Accept ISO-like with/without timezone. If missing timezone, assume Z (UTC)
      const hasTZ = /[zZ]|[+\-]\d{2}:?\d{2}$/.test(value);
      const normalized = hasTZ ? value : (value.endsWith('Z') ? value : `${value.replace(/\s+/g, '')}Z`);
      const d = new Date(normalized);
      if (isNaN(d.getTime())) throw new Error(`${label} is not a valid date/time`);
      return d.toISOString();
    } catch (e: any) {
      throw new Error(`${label}: ${e.message}`);
    }
  };

  // Mapping scope loaders (independent lists so we don't disturb AF tab selections)
  const ensureMappingAssetServers = async () => {
    try {
      const data = await client.getAssetServers();
      setAssetServers(data?.Items ?? []);
      toast({ title: 'Servers loaded', description: `${(data?.Items ?? []).length} server(s)` });
    } catch (e: any) {
      toast({ title: 'Load servers failed', description: e.message, variant: 'destructive' });
    }
  };

  const loadMappingAFDatabases = async (serverWebId: string) => {
    try {
      const res = await client.getAFDatabases(serverWebId);
      setMappingDatabases(res?.Items ?? []);
    } catch (e: any) {
      toast({ title: 'Load AF Databases failed', description: e.message, variant: 'destructive' });
    }
  };

  const loadMappingRootElements = async (dbWebId: string) => {
    try {
      const res = await client.getDatabaseElements(dbWebId);
      setMappingRootElements(res?.Items ?? []);
    } catch (e: any) {
      toast({ title: 'Load AF Elements failed', description: e.message, variant: 'destructive' });
    }
  };
  const APP_FIELDS: string[] = [
    'description','reasonCodeId','oeeCodeId','impactCodeId','quantity','cost','shift','crew','lossCategory',
    'parameter','limit','limitType','recommendedAction',
    'apmType','severity','workOrderId','failureMode','defectiveQuantity',
  ];

  const loadTemplateAttributes = async (tpl: string) => {
    try {
      setAttrLoadingTpl(prev => ({ ...prev, [tpl]: true }));
      const startIso = toIsoOrThrow(mappingStart, 'Mapping Start');
      const endIso = toIsoOrThrow(mappingEnd, 'Mapping End');
      // fetch one EF for template in current scope
      const res = await client.getEventFrames({
        elementWebId: mappingScopeType === 'element' ? mappingSelectedRoot : undefined,
        databaseWebId: mappingScopeType === 'database' ? mappingSelectedDb : undefined,
        startTimeUtc: startIso,
        endTimeUtc: endIso,
        templateName: tpl === 'All templates' || tpl === '*NoTemplate*' ? undefined : tpl,
        maxCount: 1,
      });
      const ef = (res?.Items ?? [])[0];
      if (!ef) {
        toast({ title: 'No sample EF', description: `No EF found for template ${tpl} in this window`, variant: 'destructive' });
        return;
      }
      const ar = await client.getEventFrameAttributes(ef.WebId);
      const names = (ar?.Items ?? []).map((a: any) => a.Name).filter(Boolean);
      setAttrOptionsByTemplate(prev => ({ ...prev, [tpl]: names }));
      // seed mapping if not present
      setAttrMapByTemplate(prev => ({ ...prev, [tpl]: prev[tpl] || {} }));
    } catch (e: any) {
      toast({ title: 'Load attributes failed', description: e.message, variant: 'destructive' });
    } finally {
      setAttrLoadingTpl(prev => ({ ...prev, [tpl]: false }));
    }
  };

  // Discover actual PI templates in current scope/time and merge into efTemplates
  const discoverTemplates = async () => {
    try {
      if (scopeType === 'element' && !selectedRoot) throw new Error('Select AF Root in AF tab');
      if (scopeType === 'database' && !selectedDb) throw new Error('Select AF Database in AF tab');
      setDiscoverLoading(true);
      const startIso = toIsoOrThrow(mappingStart, 'Mapping Start');
      const endIso = toIsoOrThrow(mappingEnd, 'Mapping End');
      const res = await client.getEventFrames({
        elementWebId: mappingScopeType === 'element' ? mappingSelectedRoot : undefined,
        databaseWebId: mappingScopeType === 'database' ? mappingSelectedDb : undefined,
        startTimeUtc: startIso,
        endTimeUtc: endIso,
        maxCount: 100,
        selectedFields: 'Items.TemplateName',
      });
      const items: any[] = res?.Items ?? [];
      const names = Array.from(new Set(items.map(i => i.TemplateName).filter(Boolean))).sort();
      if (names.length === 0) {
        toast({ title: 'No templates found', description: 'Try widening the time range or switching scope', variant: 'destructive' });
        return;
      }
      setEfTemplates(prev => {
        const base = new Set(prev);
        for (const n of names) base.add(n);
        // Ensure control options exist
        base.add('All templates');
        base.add('*NoTemplate*');
        return Array.from(base);
      });
      toast({ title: 'Templates discovered', description: `${names.length} templates merged into list` });
    } catch (e: any) {
      toast({ title: 'Discover failed', description: e.message, variant: 'destructive' });
    } finally {
      setDiscoverLoading(false);
    }
  };

  const onTest = async () => {
    try {
      // Simple ping: list asset servers
      const data = await client.getAssetServers();
      const items = data?.Items ?? [];
      setAssetServers(items);
      const count = items.length;
      toast({ title: 'PI Connection OK', description: `Asset Servers: ${count}` });
      
      // If we have asset servers, also load databases for the first one to test full connectivity
      if (items.length > 0 && !selectedServer) {
        try {
          const firstServer = items[0];
          const databasesRes = await client.getAFDatabases(firstServer.WebId);
          setDatabases(databasesRes?.Items ?? []);
          console.log('Loaded databases for first server:', databasesRes?.Items?.length || 0);
        } catch (error) {
          console.warn('Failed to load databases for first server:', error);
        }
      }
    } catch (e: any) {
      toast({ title: 'PI Connection Failed', description: e.message, variant: 'destructive' });
    }
  };

  const loadAssetServers = async () => {
    try {
      if (!client) {
        toast({ title: 'No PI Client', description: 'Please configure PI connection first', variant: 'destructive' });
        return;
      }
      const data = await client.getAssetServers();
      const items = data?.Items ?? [];
      setAssetServers(items);
      console.log('Loaded asset servers:', items.length);
      if (items.length > 0) {
        toast({ title: 'Asset Servers Loaded', description: `${items.length} server(s) found` });
      } else {
        toast({ title: 'No Asset Servers', description: 'No asset servers found on this PI system', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Load Asset Servers Failed', description: e.message, variant: 'destructive' });
    }
  };

  const loadDatabases = async (serverWebId: string) => {
    try {
      const res = await client.getAFDatabases(serverWebId);
      setDatabases(res?.Items ?? []);
    } catch (e: any) {
      toast({ title: 'Load AF Databases failed', description: e.message, variant: 'destructive' });
    }
  };

  const loadRootElements = async (dbWebId: string) => {
    try {
      const res = await client.getDatabaseElements(dbWebId);
      setRootElements(res?.Items ?? []);
    } catch (e: any) {
      toast({ title: 'Load AF Elements failed', description: e.message, variant: 'destructive' });
    }
  };

  const toggleExpand = async (webId: string) => {
    setExpanded(prev => ({ ...prev, [webId]: !prev[webId] }));
    if (!children[webId]) {
      try {
        const res = await client.getElementChildren(webId);
        setChildren(prev => ({ ...prev, [webId]: res?.Items ?? [] }));
      } catch (e: any) {
        toast({ title: 'Load children failed', description: e.message, variant: 'destructive' });
      }
    }
  };

  const bindNode = async (webId: string, type: 'unit'|'asset') => {
    // legacy prompt replaced by dialog-based binding
    setBindType(type); setBindWebId(webId); setBindOpen(true);
  };

  const [selectedElement, setSelectedElement] = useState<any | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<any[]>([]);
  // Historian explicit attribute selection
  const [histAttrs, setHistAttrs] = useState<any[] | null>(null);
  const [attrLoading, setAttrLoading] = useState<boolean>(false);
  const [selectedElementPath, setSelectedElementPath] = useState<string>('');
  const [bindOpen, setBindOpen] = useState(false);
  const [bindType, setBindType] = useState<'unit'|'asset'>('unit');
  const [bindWebId, setBindWebId] = useState<string>('');
  const [orgList, setOrgList] = useState<AppOrg[]>([]);
  const [tenantList, setTenantList] = useState<AppTenant[]>([]);
  const [unitsList, setUnitsList] = useState<AppUnit[]>([]);
  const [assetsList, setAssetsList] = useState<AppAsset[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedLocalId, setSelectedLocalId] = useState<string>('');
  const [assetSearch, setAssetSearch] = useState<string>('');
  const [unitSearch, setUnitSearch] = useState<string>('');

  // Binding details modal state
  const [bindingOpen, setBindingOpen] = useState(false);
  const [bindingLoading, setBindingLoading] = useState(false);
  const [bindingError, setBindingError] = useState<string>('');
  const [bindingInfo, setBindingInfo] = useState<{
    boundType: 'unit'|'asset';
    localId: string;
    appUnit?: AppUnit | null;
    appAsset?: AppAsset | null;
    appTenant?: AppTenant | null;
    piElement?: any | null;
  } | null>(null);

  const openBindingDetails = async (webId: string) => {
    const b = bindings[webId];
    if (!b) return;
    setBindingOpen(true);
    setBindingLoading(true);
    setBindingError('');
    try {
      const tenantsPromise = masterDataService.getTenants({});
      if (b.type === 'unit') {
        const [units, tenants, piEl] = await Promise.all([
          masterDataService.getUnits({}),
          tenantsPromise,
          client.getElement(webId).catch(() => null),
        ]);
        const appUnit = units.find(u => u.id === b.localId) || null;
        const appTenant = tenants.find(t => t.id === (appUnit as any)?.tenantId) || null;
        setBindingInfo({ boundType: 'unit', localId: b.localId, appUnit, appTenant, piElement: piEl });
      } else {
        const [assets, units, tenants, piEl] = await Promise.all([
          masterDataService.getAssets({}),
          masterDataService.getUnits({}),
          tenantsPromise,
          client.getElement(webId).catch(() => null),
        ]);
        const appAsset = assets.find(a => a.id === b.localId) || null;
        const appUnit = units.find(u => u.id === (appAsset as any)?.unitId) || null;
        const appTenant = tenants.find(t => t.id === (appAsset as any)?.tenantId || (appUnit as any)?.tenantId) || null;
        setBindingInfo({ boundType: 'asset', localId: b.localId, appAsset, appUnit, appTenant, piElement: piEl });
      }
    } catch (e: any) {
      setBindingError(e?.message || 'Failed to load binding details');
    } finally {
      setBindingLoading(false);
    }
  };

  // Attribute detail modal
  const [attrModalOpen, setAttrModalOpen] = useState(false);
  const [attrModalData, setAttrModalData] = useState<any | null>(null);
  const openAttrModal = (attr: any) => { setAttrModalData(attr); setAttrModalOpen(true); };
  const renderAttrValue = (a: any) => {
    const v = typeof a?._ResolvedValue !== 'undefined' ? a._ResolvedValue : (typeof a?.Value?.Value !== 'undefined' ? a.Value.Value : a?.Value);
    if (v === null || typeof v === 'undefined') return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const loadElementAttributes = async (webId: string) => {
    try {
      setAttrLoading(true);
      const res = await client.getElementAttributes(webId, 'Items.Name;Items.WebId;Items.Value;Items.Type;Items.Description;Items.Path;Items.Step;Items.DefaultUnitsName;Items.DataReferencePlugInName;Items.ConfigString;Items.Links.Value;Items.Links.Point');
      const items = res?.Items ?? [];
      const enriched = await Promise.all(items.map(async (a: any) => {
        try {
          // Prefer Streams/{webId}/value if provided in Links.Value
          const linkValue = a?.Links?.Value as string | undefined;
          if (linkValue) {
            const v = await client.getByLink(linkValue);
            return { ...a, _ResolvedValue: v?.Value ?? v };
          }
          if (a?.WebId) {
            const v = await client.getAttributeValue(a.WebId);
            return { ...a, _ResolvedValue: v?.Value ?? v };
          }
        } catch {}
        return a;
      }));
      setSelectedAttributes(enriched);
    } catch (e: any) {
      toast({ title: 'Load attributes failed', description: e.message, variant: 'destructive' });
    } finally {
      setAttrLoading(false);
    }
  };

  const loadElementDetails = async (webId: string) => {
    try {
      const el = await client.getElement(webId);
      setSelectedElementPath(el?.Path || '');
    } catch {}
  };

  const Node: React.FC<{ node: any; level: number }> = ({ node, level }) => {
    const hasChildren = true; // lazy assume; PI returns children if any
    const isOpen = !!expanded[node.WebId];
    const kids = children[node.WebId] || [];
    const b = bindings[node.WebId];
    return (
      <div>
        <div
          className="group flex items-center gap-2 py-1 px-2 rounded-md transition-colors hover:bg-blue-50"
          style={{ paddingLeft: level * 16 }}
          onClick={() => { setSelectedElement(node); loadElementDetails(node.WebId); loadElementAttributes(node.WebId); }}
        >
          {hasChildren ? (
            <button
              className="p-1 rounded hover:bg-blue-100 text-blue-700"
              onClick={() => toggleExpand(node.WebId)}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4 h-4" />
          )}
          {hasChildren ? (
            isOpen ? <FolderOpen className="w-4 h-4 text-amber-600" /> : <Folder className="w-4 h-4 text-amber-600" />
          ) : (
            <Box className="w-4 h-4 text-slate-500" />
          )}
          <span className="text-sm font-medium text-slate-800 truncate">{node.Name}</span>
          {b && (
            <button
              className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200 underline decoration-dotted hover:bg-green-200"
              onClick={(e) => { e.stopPropagation(); openBindingDetails(node.WebId); }}
              title="View binding details"
            >
              bound as {b.type === 'unit' ? 'Unit' : 'Asset'}
            </button>
          )}
          <div className="ml-auto flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="outline" size="sm"
              onClick={async () => {
                setBindType('unit'); setBindWebId(node.WebId); setSelectedLocalId(''); setSelectedUnitId('');
                try {
                  const orgs = await masterDataService.getOrganizations();
                  setOrgList(orgs);
                  const tenants = await masterDataService.getTenants({ organizationId: orgs[0]?.id });
                  setTenantList(tenants);
                  setSelectedOrgId(orgs[0]?.id || '');
                  setSelectedTenantId(tenants[0]?.id || '');
                  const units = await masterDataService.getUnits({ tenantId: tenants[0]?.id });
                  setUnitsList(units);
                  setUnitSearch('');
                } catch {}
                setBindOpen(true);
              }}
              className="h-7 px-2 text-xs"
            >
              <Factory className="w-3 h-3 mr-1" /> Unit
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={async () => {
                setBindType('asset'); setBindWebId(node.WebId); setSelectedLocalId('');
                try {
                  const orgs = await masterDataService.getOrganizations();
                  setOrgList(orgs);
                  const tenants = await masterDataService.getTenants({ organizationId: orgs[0]?.id });
                  setTenantList(tenants);
                  setSelectedOrgId(orgs[0]?.id || '');
                  setSelectedTenantId(tenants[0]?.id || '');
                  const units = await masterDataService.getUnits({ tenantId: tenants[0]?.id });
                  setUnitsList(units);
                  setSelectedUnitId(units[0]?.id || '');
                  const assets = await masterDataService.getAssets({ tenantId: tenants[0]?.id });
                  setAssetsList(assets);
                  setAssetSearch('');
                } catch {}
                setBindOpen(true);
              }}
              className="h-7 px-2 text-xs"
            >
              <Wrench className="w-3 h-3 mr-1" /> Asset
            </Button>
          </div>
        </div>
        {isOpen && kids.map(k => (<Node key={k.WebId} node={k} level={level + 1} />))}
      </div>
    );
  };

  const onSaveSettings = async () => {
    try {
      const tenantId = session?.tenant?.id ?? 'default-tenant';
      await piStore.upsertConnection({
        tenantId,
        baseUrl,
        username,
        password, // DEV ONLY persistence
        assetServer: assetServers.find(s => s.WebId === selectedServer) ? { name: assetServers.find(s => s.WebId === selectedServer).Name, webId: selectedServer } : undefined,
        afDatabase: databases.find(d => d.WebId === selectedDb) ? { name: databases.find(d => d.WebId === selectedDb).Name, webId: selectedDb } : undefined,
        tzPolicy: 'utc',
        autoDeltaSyncEnabled: autoDelta,
        syncIntervalSec: intervalSec,
      } as any);
      if (selectedRoot) {
        await piStore.bindTenantRoot(tenantId, selectedRoot);
      }
      // Sync auto-delta settings to backend cron job (no browser timer)
      const scopeType = selectedRoot ? 'element' as const : 'database' as const;
      const scopeId = selectedRoot || selectedDb;
      const intervalMinutes = Math.max(1, Math.ceil(intervalSec / 60));
      if (scopeId) {
        let job = await autoPIEventSyncService.getSyncJobConfig(tenantId);
        const jobUpdates = {
          enabled: autoDelta,
          intervalMinutes,
          scopeType,
          scopeId,
        };
        if (!job) {
          await autoPIEventSyncService.createSyncJobConfig(tenantId, jobUpdates);
        } else {
          await autoPIEventSyncService.updateSyncJobConfig(tenantId, jobUpdates);
        }
      }
      toast({ title: 'PI Settings Saved', description: 'Connection saved. Auto-sync runs on the backend scheduler when enabled.' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  };

  // Load persisted settings on mount
  useEffect(() => {
    const init = async () => {
      const tenantId = session?.tenant?.id ?? 'default-tenant';
      const cfg = await piStore.getConnectionByTenant(tenantId);
      // Hydrate any previously saved PI mappings (event types and attribute maps)
      try {
        const savedMappings = await piStore.getMappings(tenantId);
        if (savedMappings) {
          if (savedMappings.templateToEventType && Object.keys(savedMappings.templateToEventType).length > 0) {
            setTemplateToType(prev => ({ ...prev, ...savedMappings.templateToEventType }));
          }
          if (savedMappings.attributesByTemplate && Object.keys(savedMappings.attributesByTemplate).length > 0) {
            setAttrMapByTemplate(prev => ({ ...prev, ...savedMappings.attributesByTemplate }));
          }
          // Ensure templates present in saved mappings appear in the Template Catalog list
          const savedTemplateNames = Array.from(new Set([
            ...Object.keys(savedMappings.templateToEventType || {}),
            ...Object.keys(savedMappings.attributesByTemplate || {}),
          ]));
          if (savedTemplateNames.length > 0) {
            setEfTemplates(prev => {
              const merged = new Set(prev);
              for (const name of savedTemplateNames) merged.add(name);
              // Always keep control options present
              merged.add('All templates');
              merged.add('*NoTemplate*');
              return Array.from(merged);
            });
          }
        }
      } catch {}
      if (cfg) {
        setBaseUrl(cfg.baseUrl || baseUrl);
        setUsername(cfg.username || '');
        setPassword(cfg.password || '');
        setAutoDelta(!!cfg.autoDeltaSyncEnabled);
        setIntervalSec(cfg.syncIntervalSec || 300);
        // Use backend-proxied client when tenant session exists
        const browseClient = session?.tenant?.id
          ? new PIClient({ tenantId: session.tenant.id })
          : (cfg.username && cfg.password
            ? new PIClient({ basePath: '/piwebapi', authProvider: async () => basicAuthHeader(cfg.username!, cfg.password!) })
            : null);
        if (browseClient) {
          try {
            const assetServersRes = await browseClient.getAssetServers();
            setAssetServers(assetServersRes?.Items ?? []);
            console.log('Loaded asset servers:', assetServersRes?.Items?.length || 0);
          } catch (error) {
            console.warn('Failed to load asset servers:', error);
          }
          
          if (cfg.assetServer?.webId) {
            setSelectedServer(cfg.assetServer.webId);
            try {
              const res = await browseClient.getAFDatabases(cfg.assetServer.webId);
              setDatabases(res?.Items ?? []);
            } catch {}
          }
          if (cfg.afDatabase?.webId) {
            setSelectedDb(cfg.afDatabase.webId);
            try {
              const res = await browseClient.getDatabaseElements(cfg.afDatabase.webId);
              setRootElements(res?.Items ?? []);
            } catch {}
          }
        }
      }
      const rootBind = await piStore.getTenantRootBinding(tenantId);
      if (rootBind?.webId) {
        setSelectedRoot(rootBind.webId);
      }
    };
    // Best-effort init (ignores errors)
    init();
    // load existing unit/asset bindings to show badges
    (async () => {
      try {
        const tenantId = session?.tenant?.id ?? 'default-tenant';
        const list = await piStore.listBindings(tenantId);
        const map: Record<string, { type: 'unit'|'asset'; localId: string }> = {};
        for (const b of list) {
          if (b.boundType === 'unit' || b.boundType === 'asset') {
            map[b.webId] = { type: b.boundType, localId: b.localId };
          }
        }
        setBindings(map);
      } catch {}
    })();
    // initial stats/watermark
    (async () => {
      try {
        const tenantId = session?.tenant?.id ?? 'default-tenant';
        const s = await piStore.getPIStats();
        setStats(s);
        const rootBind = await piStore.getTenantRootBinding(tenantId);
        if (rootBind?.webId) {
          const wm = await piStore.getWatermark(tenantId, 'element', rootBind.webId);
          setLastWatermark(wm?.lastEndUtc || '');
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshStatsAndWatermark = async () => {
    try {
      const tenantId = session?.tenant?.id ?? 'default-tenant';
      const s = await piStore.getPIStats();
      setStats(s);
      if (selectedRoot) {
        const wm = await piStore.getWatermark(tenantId, 'element', selectedRoot);
        setLastWatermark(wm?.lastEndUtc || '');
      }
    } catch {}
  };

  // Auto delta sync is handled by backend pi-sync-jobs cron (see onSaveSettings)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">AVEVA PI Integration</h2>
        <p className="text-muted-foreground">Configure PI Web API connection, browse AF, preview Event Frames, and manage mappings.</p>
        <div className="flex items-center gap-3 text-sm">
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${piOnline==='connected'?'bg-green-50 border-green-200 text-green-700':piOnline==='disconnected'?'bg-red-50 border-red-200 text-red-700':'bg-gray-50 border-gray-200 text-gray-700'}`}>
            {piOnline==='connected'?<PlugZap className="w-4 h-4"/>:piOnline==='disconnected'?<WifiOff className="w-4 h-4"/>:<Wifi className="w-4 h-4"/>}
            <span>PI Server: {piOnline==='connected'?'Connected':piOnline==='disconnected'?'Disconnected':'Unknown'}</span>
          </div>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${efEndpointOnline==='connected'?'bg-green-50 border-green-200 text-green-700':efEndpointOnline==='disconnected'?'bg-red-50 border-red-200 text-red-700':'bg-gray-50 border-gray-200 text-gray-700'}`}>
            {efEndpointOnline==='connected'?<PlugZap className="w-4 h-4"/>:efEndpointOnline==='disconnected'?<WifiOff className="w-4 h-4"/>:<Wifi className="w-4 h-4"/>}
            <span>Event Frames: {efEndpointOnline==='connected'?'Online':efEndpointOnline==='disconnected'?'Unavailable':'Unknown'}</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-gray-50 border-gray-200 text-gray-700">
            <Database className="w-4 h-4" /> Type: Aveva PI
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Last checked: {lastCheckedAt || '—'}</span>
            <Button variant="outline" size="sm" onClick={checkConnectivity} className="h-7 px-2 text-xs"><RefreshCw className="w-3 h-3 mr-1"/>Check now</Button>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="conn">Connection</TabsTrigger>
          <TabsTrigger value="af">AF Hierarchy</TabsTrigger>
          <TabsTrigger value="ef">Event Frames</TabsTrigger>
          <TabsTrigger value="hist">Historian</TabsTrigger>
          <TabsTrigger value="historian-tags">Historian Tags</TabsTrigger>
          <TabsTrigger value="map">Mapping</TabsTrigger>
          <TabsTrigger value="explore">Explorer</TabsTrigger>
          <TabsTrigger value="sync">Sync & Status</TabsTrigger>
        </TabsList>

        <TabsContent value="conn">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Cloud className="w-5 h-5"/> PI Web API Connection</CardTitle>
              <CardDescription>Enter the PI Web API endpoint and credentials. These are used at runtime and not committed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Base URL</Label>
                  <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://host:port/piwebapi" />
                </div>
                <div>
                  <Label>Username</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="DOMAIN\\user" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={onTest} className="flex items-center gap-2"><RefreshCw className="w-4 h-4"/> Test Connection</Button>
                <Button variant="outline" onClick={onSaveSettings}>Save Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hist">
          {client ? (
            <EnhancedHistorianPage 
              piClient={client} 
              tenantId={session?.tenant?.id || 'default-tenant'} 
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  PI Connection Required
                </CardTitle>
                <CardDescription>
                  Please configure your PI Web API connection in the Connection tab before using the Enhanced Historian.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>PI Web API connection not configured</p>
                  <p className="text-sm">Go to the Connection tab and enter your PI Web API endpoint and credentials</p>
                  <Button 
                    className="mt-4" 
                    onClick={() => setTab('conn')}
                  >
                    Configure Connection
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="historian-tags">
          <Card>
            <CardHeader>
              <CardTitle>Historian Tags Configuration</CardTitle>
              <CardDescription>Browse PI AF hierarchy and configure historian tags for dashboard monitoring</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <HistorianTagConfigurator 
                piClient={client} 
                tenantId={session?.tenant?.id || 'default-tenant'} 
                onTagsConfigured={(tags) => {
                  console.log('[PIIntegration] Tags configured:', tags);
                  toast({
                    title: 'Tags Configured',
                    description: `Successfully configured ${tags.length} historian tags. They will now appear on the dashboard.`,
                    variant: 'default',
                  });
                }} 
              />
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-500 mt-2">
                  Debug: Session tenant ID: {session?.tenant?.id || 'undefined'} | Using: {session?.tenant?.id || 'default-tenant'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="explore">
          <Card>
            <CardHeader>
              <CardTitle>Event Frames Explorer</CardTitle>
              <CardDescription>Scan EF across scope and group by template; preview attribute names per template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Explorer
                client={client}
                selectedDb={selectedDb}
                selectedRoot={selectedRoot}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="af">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5"/> AF Hierarchy</CardTitle>
              <CardDescription>Browse and bind AF nodes (select server, database, and root element).</CardDescription>
              <div className="flex items-center gap-2 text-sm">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${piOnline==='connected'?'bg-green-50 border-green-200 text-green-700':piOnline==='disconnected'?'bg-red-50 border-red-200 text-red-700':'bg-gray-50 border-gray-200 text-gray-700'}`}>
                  {piOnline==='connected'?<PlugZap className="w-3 h-3"/>:piOnline==='disconnected'?<WifiOff className="w-3 h-3"/>:<Wifi className="w-3 h-3"/>}
                  <span>PI: {piOnline==='connected'?'Connected':piOnline==='disconnected'?'Disconnected':'Unknown'}</span>
                </div>
                {assetServers.length > 0 && (
                  <div className="text-green-600 text-xs">
                    {assetServers.length} server(s) loaded
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-4 gap-4 flex-1">
                  <div>
                    <Label>Scope</Label>
                    <select className="w-full border rounded px-2 py-1" value={scopeType} onChange={(e) => setScopeType(e.target.value as any)}>
                      <option value="element">Element (Root)</option>
                      <option value="database">Database</option>
                    </select>
                  </div>
                  <div>
                    <Label>Asset Server</Label>
                    <select className="w-full border rounded px-2 py-1" value={selectedServer} onChange={async (e) => { const id = e.target.value; setSelectedServer(id); if (id) await loadDatabases(id); }}>
                      <option value="">Select server</option>
                      {assetServers.map(s => (<option key={s.WebId} value={s.WebId}>{s.Name}</option>))}
                    </select>
                  </div>
                  <div>
                    <Label>AF Database</Label>
                    <select className="w-full border rounded px-2 py-1" value={selectedDb} onChange={async (e) => { const id = e.target.value; setSelectedDb(id); if (id) await loadRootElements(id); }} disabled={!selectedServer}>
                      <option value="">Select database</option>
                      {databases.map(d => (<option key={d.WebId} value={d.WebId}>{d.Name}</option>))}
                    </select>
                  </div>
                  <div hidden={scopeType !== 'element'}>
                    <Label>Root Element</Label>
                    <select className="w-full border rounded px-2 py-1" value={selectedRoot} onChange={(e) => setSelectedRoot(e.target.value)} disabled={!selectedDb}>
                      <option value="">Select root</option>
                      {rootElements.map(el => (<option key={el.WebId} value={el.WebId}>{el.Name}</option>))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadAssetServers}
                    disabled={!client}
                    className="whitespace-nowrap"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Load Servers
                  </Button>
                </div>
              </div>
              
              {!client && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <Info className="w-4 h-4" />
                    <span className="text-sm font-medium">PI Connection Required</span>
                  </div>
                  <p className="text-xs text-yellow-700 mt-1">
                    Please configure your PI connection in the "Connection" tab first to load asset servers.
                  </p>
                </div>
              )}
              
              {client && assetServers.length === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Info className="w-4 h-4" />
                    <span className="text-sm font-medium">No Asset Servers Loaded</span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Click "Load Servers" to fetch available asset servers from your PI system.
                  </p>
                </div>
              )}
              {selectedRoot && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Selected Root WebId: {selectedRoot}</div>
                  <div className="grid grid-cols-5 gap-4">
                    <div className="col-span-3 border rounded max-h-[520px] overflow-auto bg-white/70">
                      {/* Root node entry */}
                      {(() => {
                        const rootNode = rootElements.find(el => el.WebId === selectedRoot) || rootElements[0];
                        return rootNode ? <Node node={rootNode} level={0} /> : null;
                      })()}
                    </div>
                    <div className="col-span-2 border rounded bg-white/70 p-3 max-h-[520px] overflow-auto">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold">Attributes</div>
                          <div className="text-xs text-muted-foreground break-all">{selectedElement ? selectedElement.Name : 'Select an element'}</div>
                          {selectedElement && (
                            <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-2">
                              <span className="font-medium">Path:</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="truncate max-w-[260px] cursor-help underline decoration-dotted">
                                      {selectedElementPath || '—'}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[480px] break-all">
                                    {selectedElementPath || '—'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {selectedElementPath && (
                                <button
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs hover:bg-slate-50"
                                  onClick={() => navigator.clipboard.writeText(selectedElementPath)}
                                  title="Copy path"
                                >
                                  <Copy className="w-3 h-3" /> Copy
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {selectedElement && (
                          <Button variant="outline" size="sm" onClick={() => loadElementAttributes(selectedElement.WebId)} className="h-7 px-2 text-xs">Refresh</Button>
                        )}
                      </div>
                      {attrLoading ? (
                        <div className="text-xs text-muted-foreground">Loading attributes…</div>
                      ) : selectedElement ? (
                        <div className="space-y-2">
                          {selectedAttributes.length === 0 && (
                            <div className="text-xs text-muted-foreground">No attributes found.</div>
                          )}
                      {selectedAttributes.map((a: any) => (
                            <button
                              key={a.WebId || a.Name}
                          className="w-full text-left flex items-start justify-between gap-3 border-b pb-2 hover:bg-blue-50/60 rounded px-1"
                          onClick={() => openAttrModal(a)}
                            >
                              <div>
                                <div className="text-sm font-medium flex items-center gap-1"><Hash className="w-3 h-3 text-slate-500" />{a.Name}</div>
                                {a.Description && <div className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" />{a.Description}</div>}
                              </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-slate-700 max-w-[50%] break-all">
                              {renderAttrValue(a)}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setHistAttrs([a]);
                                setTab('hist');
                              }}
                            >History</Button>
                          </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Select an element to view attributes.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            {/* Attribute Detail Modal */}
            <Dialog open={attrModalOpen} onOpenChange={setAttrModalOpen}>
              <DialogContent className="sm:max-w-[620px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><Info className="w-4 h-4 text-blue-600" /> Attribute Details</DialogTitle>
                </DialogHeader>
                {attrModalData && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-3">
                        <div className="text-xs text-muted-foreground">Attribute Name</div>
                        <div className="text-base font-semibold flex items-center gap-2"><Hash className="w-4 h-4 text-slate-500" />{attrModalData.Name}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Type</div>
                        <div className="text-sm font-medium">{attrModalData.Type || '—'}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">Current Value</div>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => navigator.clipboard.writeText(renderAttrValue(attrModalData))}>Copy</Button>
                        </div>
                        <div className="mt-1 text-sm font-medium break-words bg-slate-50 border rounded p-2 min-h-[40px]">{renderAttrValue(attrModalData)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Units</div>
                        <div className="text-sm font-medium">{attrModalData.DefaultUnitsName || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Step (Discrete)</div>
                        <div className="text-sm font-medium">{String(attrModalData.Step ?? '—')}</div>
                      </div>
                      <div className="col-span-3">
                        <div className="text-xs text-muted-foreground">Data Reference</div>
                        <div className="text-sm font-medium">{attrModalData.DataReferencePlugInName || '—'}</div>
                      </div>
                    </div>
                    {attrModalData.Description && (
                      <div>
                        <div className="text-xs text-muted-foreground">Description</div>
                        <div className="text-sm">{attrModalData.Description}</div>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Attribute Path</div>
                        <div className="text-[11px] break-all">{attrModalData.Path || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Categories</div>
                        <div className="text-sm">{(attrModalData.CategoryNames || []).join(', ') || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">PI Point Link</div>
                        <div className="text-[11px] break-all">{attrModalData.Links?.Point ? 'Linked' : '—'}</div>
                      </div>
                    </div>
                    {selectedElement && (
                      <div>
                        <div className="text-xs text-muted-foreground">Element</div>
                        <div className="text-sm font-medium">{selectedElement.Name}</div>
                        <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-2">
                          <span className="font-medium">Path:</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate max-w-[460px] cursor-help underline decoration-dotted">{selectedElementPath || '—'}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[520px] break-all">{selectedElementPath || '—'}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              setHistAttrs([attrModalData]);
                              setAttrModalOpen(false);
                              setTab('hist');
                            }}
                          >View history</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
            {/* Bind Dialog */}
            <Dialog open={bindOpen} onOpenChange={setBindOpen}>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Bind AF Element as {bindType === 'unit' ? 'Unit' : 'Asset'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Organization</Label>
                      <select className="w-full border rounded px-2 py-1" value={selectedOrgId} onChange={async (e) => {
                        const orgId = e.target.value; setSelectedOrgId(orgId);
                        const tenants = await masterDataService.getTenants({ organizationId: orgId });
                        setTenantList(tenants); setSelectedTenantId(tenants[0]?.id || '');
                        const units = await masterDataService.getUnits({ tenantId: tenants[0]?.id });
                        setUnitsList(units); setSelectedUnitId('');
                        const assets = await masterDataService.getAssets({ tenantId: tenants[0]?.id });
                        setAssetsList(assets);
                      }}>
                        {orgList.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
                      </select>
                    </div>
                    <div>
                      <Label>Tenant</Label>
                      <select className="w-full border rounded px-2 py-1" value={selectedTenantId} onChange={async (e) => {
                        const tId = e.target.value; setSelectedTenantId(tId);
                        const units = await masterDataService.getUnits({ tenantId: tId }); setUnitsList(units); setSelectedUnitId('');
                        const assets = await masterDataService.getAssets({ tenantId: tId }); setAssetsList(assets);
                      }}>
                        {tenantList.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                      </select>
                    </div>
                    <div>
                      <Label>Unit filter</Label>
                      <input className="w-full border rounded px-2 py-1" placeholder="Type to filter units…" value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} />
                    </div>
                  </div>
                  {bindType === 'asset' && (
                    <div>
                      <Label>Select Unit (to filter assets)</Label>
                      <select className="w-full border rounded px-2 py-1" value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
                        <option value="">All Units</option>
                        {unitsList.filter(u => !unitSearch || u.name.toLowerCase().includes(unitSearch.toLowerCase()) || u.code.toLowerCase().includes(unitSearch.toLowerCase())).map(u => (<option key={u.id} value={u.id}>{u.name} ({u.code})</option>))}
                      </select>
                    </div>
                  )}
                  <div>
                    <Label>{bindType === 'unit' ? 'Choose Unit' : 'Choose Asset'}</Label>
                    <input className="w-full border rounded px-2 py-1 mb-2" placeholder={bindType==='unit'?'Search units…':'Search assets…'} value={bindType==='unit'?unitSearch:assetSearch} onChange={(e) => bindType==='unit'?setUnitSearch(e.target.value):setAssetSearch(e.target.value)} />
                    <select className="w-full border rounded px-2 py-1" value={selectedLocalId} onChange={(e) => setSelectedLocalId(e.target.value)}>
                      <option value="">Select…</option>
                      {bindType === 'unit' && unitsList
                        .filter(u => !unitSearch || u.name.toLowerCase().includes(unitSearch.toLowerCase()) || u.code.toLowerCase().includes(unitSearch.toLowerCase()))
                        .map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                      ))}
                      {bindType === 'asset' && assetsList
                        .filter(a => (!selectedUnitId || a.unitId === selectedUnitId) && (!assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.code.toLowerCase().includes(assetSearch.toLowerCase())))
                        .map(a => (<option key={a.id} value={a.id}>{a.name} ({a.code})</option>))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setBindOpen(false)}>Cancel</Button>
                    <Button onClick={async () => {
                      if (!bindWebId || !selectedLocalId) return;
                      try {
                        const tenantId = session?.tenant?.id ?? 'default-tenant';
                        await piStore.bindNode({ tenantId, webId: bindWebId, boundType: bindType, localId: selectedLocalId });
                        setBindings(prev => ({ ...prev, [bindWebId]: { type: bindType, localId: selectedLocalId } }));
                        toast({ title: 'Bound', description: `AF node bound as ${bindType} → ${selectedLocalId}` });
                        setBindOpen(false);
                      } catch (e: any) {
                        toast({ title: 'Bind failed', description: e.message, variant: 'destructive' });
                      }
                    }}>Bind</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* Binding Details Modal */}
            <Dialog open={bindingOpen} onOpenChange={setBindingOpen}>
              <DialogContent className="sm:max-w-[720px]">
                <DialogHeader>
                  <DialogTitle>Binding Details</DialogTitle>
                </DialogHeader>
                {bindingLoading ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : bindingError ? (
                  <div className="text-sm text-red-600">{bindingError}</div>
                ) : bindingInfo ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded p-3 bg-white/70">
                        <div className="text-xs text-muted-foreground">Application</div>
                        <div className="mt-1 text-sm">
                          <div className="font-semibold">{bindingInfo.boundType === 'unit' ? (bindingInfo.appUnit?.name || '—') : (bindingInfo.appAsset?.name || '—')}</div>
                          <div className="text-xs text-slate-600">Type: {bindingInfo.boundType === 'unit' ? 'Unit' : 'Asset'}</div>
                          <div className="mt-1 text-xs">Code: {(bindingInfo.boundType === 'unit' ? bindingInfo.appUnit?.code : bindingInfo.appAsset?.code) || '—'}</div>
                          {bindingInfo.boundType === 'unit' && (
                            <>
                              <div className="text-xs">Tenant: {bindingInfo.appTenant?.name || '—'}</div>
                              <div className="text-xs">Capacity: {bindingInfo.appUnit?.capacity ?? '—'} {bindingInfo.appUnit?.unitOfMeasure || ''}</div>
                              <div className="text-xs">Ideal Cycle Time: {bindingInfo.appUnit?.idealCycleTime ?? '—'} s/unit</div>
                            </>
                          )}
                          {bindingInfo.boundType === 'asset' && (
                            <>
                              <div className="text-xs">Tenant: {bindingInfo.appTenant?.name || '—'}</div>
                              <div className="text-xs">Unit: {bindingInfo.appUnit?.name || '—'}</div>
                              <div className="text-xs">Type: {bindingInfo.appAsset?.assetType || '—'} • Criticality: {bindingInfo.appAsset?.criticality || '—'}</div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="border rounded p-3 bg-white/70">
                        <div className="text-xs text-muted-foreground">PI AF Element</div>
                        <div className="mt-1 text-sm">
                          <div className="font-semibold">{bindingInfo.piElement?.Name || '—'}</div>
                          <div className="text-xs text-slate-600 break-all">Path: {bindingInfo.piElement?.Path || '—'}</div>
                          <div className="text-xs">Template: {bindingInfo.piElement?.TemplateName || '—'}</div>
                          <div className="text-xs">Categories: {(bindingInfo.piElement?.CategoryNames || []).join(', ') || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No details available.</div>
                )}
              </DialogContent>
            </Dialog>
            </CardContent>
            <div className="p-4 flex gap-2 justify-end">
              <Button variant="outline" onClick={onSaveSettings}>Save AF Selection</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="ef">
          <Card>
            <CardHeader>
              <CardTitle>Event Frames Preview</CardTitle>
              <CardDescription>Fetch EF by AF root and time window</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-3 items-end">
                <div>
                  <Label>Template</Label>
                  <select className="w-full border rounded px-2 py-1" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
                    {efTemplates.map(t => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <div>
                  <Label>Scope</Label>
                  <select className="w-full border rounded px-2 py-1" value={scopeType} onChange={(e) => setScopeType(e.target.value as any)}>
                    <option value="element">Element (Root)</option>
                    <option value="database">Database</option>
                  </select>
                </div>
                <div>
                  <Label>Start (UTC ISO)</Label>
                  <Input value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
                </div>
                <div>
                  <Label>End (UTC ISO)</Label>
                  <Input value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
                </div>
                <div>
                  <Button onClick={async () => {
                    try {
                      if (scopeType === 'element' && !selectedRoot) throw new Error('Select AF Root first');
                      if (scopeType === 'database' && !selectedDb) throw new Error('Select AF Database in AF tab');
                      setEfLoading(true);
                      setEfPage(1);
                      setEfMaxVisited(1);
                      // reset caches for new key
                      setEfCache(prev => ({ ...prev, [efKey]: {} }));
                      setEfHasNextByPage(prev => ({ ...prev, [efKey]: {} }));
                      const { items, hasNext } = await fetchEfPage(1);
                      setPreview(items);
                      setEfHasNext(hasNext);
                      // prefetch next
                      if (hasNext) { fetchEfPage(2).catch(() => {}); }
                      toast({ title: 'EF Loaded', description: `${items.length} items (page 1)` });
                    } catch (e: any) {
                      toast({ title: 'EF load failed', description: e.message, variant: 'destructive' });
                    } finally {
                      setEfLoading(false);
                    }
                  }}>Load</Button>
                </div>
              </div>
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Template</th>
                      <th className="text-left p-2">Start</th>
                      <th className="text-left p-2">End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((ef: any) => (
                      <tr key={ef.WebId} className="border-t">
                        <td className="p-2">{ef.Name}</td>
                        <td className="p-2">{ef.TemplateName}</td>
                        <td className="p-2">{ef.StartTime}</td>
                        <td className="p-2">{ef.EndTime}</td>
                      </tr>
                    ))}
                    {preview.length === 0 && (
                      <tr><td className="p-2 text-muted-foreground" colSpan={4}>No results</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={efLoading || efPage === 1} onClick={async () => {
                  const target = efPage - 1;
                  try {
                    setEfLoading(true);
                    const cached = efCache[efKey]?.[target];
                    if (cached) {
                      setPreview(cached);
                      setEfPage(target);
                      setEfHasNext(!!efHasNextByPage[efKey]?.[target]);
                    } else {
                      const { items, hasNext } = await fetchEfPage(target);
                      setPreview(items);
                      setEfPage(target);
                      setEfHasNext(hasNext);
                    }
                  } catch (e: any) {
                    toast({ title: 'EF load failed', description: e.message, variant: 'destructive' });
                  } finally { setEfLoading(false); }
                }}>Prev</Button>
                {Array.from({ length: efHasNext ? efMaxVisited + 1 : efMaxVisited }, (_, i) => i + 1).map(p => (
                  <Button key={p} variant={p === efPage ? 'default' : 'outline'} disabled={efLoading} onClick={async () => {
                    try {
                      setEfLoading(true);
                      const cached = efCache[efKey]?.[p];
                      if (cached) {
                        setPreview(cached);
                        setEfPage(p);
                        setEfMaxVisited(prev => Math.max(prev, p));
                        setEfHasNext(!!efHasNextByPage[efKey]?.[p]);
                      } else {
                        const { items, hasNext } = await fetchEfPage(p);
                        setPreview(items);
                        setEfPage(p);
                        setEfMaxVisited(prev => Math.max(prev, p));
                        setEfHasNext(hasNext);
                        // prefetch next
                        if (hasNext && !efCache[efKey]?.[p + 1]) { fetchEfPage(p + 1).catch(() => {}); }
                      }
                    } catch (e: any) {
                      toast({ title: 'EF load failed', description: e.message, variant: 'destructive' });
                    } finally { setEfLoading(false); }
                  }}>{p}</Button>
                ))}
                <Button variant="outline" disabled={efLoading || !efHasNext} onClick={async () => {
                  const target = efPage + 1;
                  try {
                    setEfLoading(true);
                    const cached = efCache[efKey]?.[target];
                    if (cached) {
                      setPreview(cached);
                      setEfPage(target);
                      setEfMaxVisited(prev => Math.max(prev, target));
                      setEfHasNext(!!efHasNextByPage[efKey]?.[target]);
                    } else {
                      const { items, hasNext } = await fetchEfPage(target);
                      setPreview(items);
                      setEfPage(target);
                      setEfMaxVisited(prev => Math.max(prev, target));
                      setEfHasNext(hasNext);
                      if (hasNext && !efCache[efKey]?.[target + 1]) { fetchEfPage(target + 1).catch(() => {}); }
                    }
                  } catch (e: any) {
                    toast({ title: 'EF load failed', description: e.message, variant: 'destructive' });
                  } finally { setEfLoading(false); }
                }}>Next</Button>
                {efLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Mapping</CardTitle>
              <CardDescription>Define event type per template and map EF attributes to app fields (no JSON needed)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Templates shown are dynamic. Discover actual PI templates for the current scope/time window.</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={discoverTemplates} disabled={discoverLoading} className="h-7 px-2 text-xs">{discoverLoading ? 'Discovering…' : 'Discover templates'}</Button>
                  <Button variant="default" size="sm" className="h-7 px-2 text-xs" onClick={() => { setManageOpen(true); if (!manageSelectedTpl && efTemplates.length > 0) setManageSelectedTpl(efTemplates[0]); }}>Manage mappings</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <Label>Mapping Start (UTC ISO)</Label>
                  <Input value={mappingStart} onChange={(e) => setMappingStart(e.target.value)} />
                </div>
                <div>
                  <Label>Mapping End (UTC ISO)</Label>
                  <Input value={mappingEnd} onChange={(e) => setMappingEnd(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 items-end">
                <div>
                  <Label>Scope</Label>
                  <select className="w-full border rounded px-2 py-1" value={mappingScopeType} onChange={(e) => setMappingScopeType(e.target.value as any)}>
                    <option value="database">Database</option>
                    <option value="element">Element (Root)</option>
                  </select>
                </div>
                <div>
                  <Label>Asset Server</Label>
                  <select className="w-full border rounded px-2 py-1" value={mappingSelectedServer} onChange={async (e) => { const v = e.target.value; setMappingSelectedServer(v); setMappingSelectedDb(''); setMappingSelectedRoot(''); await loadMappingAFDatabases(v); }} onClick={() => { if ((assetServers||[]).length===0) ensureMappingAssetServers(); }}>
                    <option value="">Select server</option>
                    {assetServers.map(s => (<option key={s.WebId} value={s.WebId}>{s.Name}</option>))}
                  </select>
                </div>
                <div>
                  <Label>AF Database</Label>
                  <select className="w-full border rounded px-2 py-1" value={mappingSelectedDb} onChange={async (e) => { const v = e.target.value; setMappingSelectedDb(v); setMappingSelectedRoot(''); if (v) await loadMappingRootElements(v); }} disabled={!mappingSelectedServer}>
                    <option value="">Select database</option>
                    {mappingDatabases.map(d => (<option key={d.WebId} value={d.WebId}>{d.Name}</option>))}
                  </select>
                </div>
                <div hidden={mappingScopeType!=='element'}>
                  <Label>Root Element</Label>
                  <select className="w-full border rounded px-2 py-1" value={mappingSelectedRoot} onChange={(e) => setMappingSelectedRoot(e.target.value)} disabled={!mappingSelectedDb}>
                    <option value="">Select root</option>
                    {mappingRootElements.map(el => (<option key={el.WebId} value={el.WebId}>{el.Name}</option>))}
                  </select>
                </div>
              </div>
              {/* Beautified Template Catalog */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-sm font-medium">Template Catalog</div>
                <div className="flex items-center gap-2">
                  <Input placeholder="Filter templates…" value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)} className="h-8 w-64" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {efTemplates
                  .filter(t => !templateFilter || t.toLowerCase().includes(templateFilter.toLowerCase()))
                  .map((tpl) => {
                    const mapped = Object.keys(attrMapByTemplate[tpl] || {}).length;
                    const loaded = (attrOptionsByTemplate[tpl] || []).length;
                    return (
                      <Card key={tpl} className="border rounded-lg">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Hash className="w-4 h-4 text-slate-500" />
                                <CardTitle className="text-sm truncate max-w-[220px]" title={tpl}>{tpl}</CardTitle>
                              </div>
                              <CardDescription className="text-xs">Choose event type and map fields</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 border text-blue-700">Mapped {mapped}</span>
                              <span className="text-[11px] px-2 py-0.5 rounded bg-gray-50 border">Attrs {loaded}</span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 pt-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <select className="border rounded px-2 py-1 text-xs" value={templateToType[tpl] || ''} onChange={(e) => setTemplateToType(prev => ({ ...prev, [tpl]: e.target.value }))}>
                              <option value="">Event Type…</option>
                              <option value="ProductionLoss">ProductionLoss</option>
                              <option value="IOW">IOW</option>
                              <option value="SOL">SOL</option>
                              <option value="APM">APM</option>
                              <option value="FailureWO">FailureWO</option>
                              <option value="ProductionOutput">ProductionOutput</option>
                            </select>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => loadTemplateAttributes(tpl)} disabled={!!attrLoadingTpl[tpl]}>
                              {attrLoadingTpl[tpl] ? 'Loading…' : 'Load attributes'}
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => { setManageSelectedTpl(tpl); setManageOpen(true); }}>Edit</Button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(attrMapByTemplate[tpl] || {}).slice(0,5).map(([attr, field]) => (
                              <span key={attr} className="text-[11px] px-2 py-0.5 rounded bg-slate-50 border" title={`${attr} → ${field}`}>{attr} → {field}</span>
                            ))}
                            {Object.keys(attrMapByTemplate[tpl] || {}).length === 0 && (
                              <span className="text-[11px] text-muted-foreground">No mappings yet</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">Hint: Map text to description/parameter; numeric to quantity/cost; use limit/limitType for excursions.</div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>

              <Accordion type="multiple" className="w-full mt-2">
                {efTemplates.map(tpl => (
                  <AccordionItem key={tpl} value={tpl}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{tpl}</span>
                        <select className="border rounded px-2 py-1 text-sm" value={templateToType[tpl] || ''} onChange={(e) => setTemplateToType(prev => ({ ...prev, [tpl]: e.target.value }))}>
                          <option value="">Event Type…</option>
                          <option value="ProductionLoss">ProductionLoss</option>
                          <option value="IOW">IOW</option>
                          <option value="SOL">SOL</option>
                          <option value="APM">APM</option>
                          <option value="FailureWO">FailureWO</option>
                          <option value="ProductionOutput">ProductionOutput</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); loadTemplateAttributes(tpl); }} disabled={!!attrLoadingTpl[tpl]}>
                          {attrLoadingTpl[tpl] ? 'Loading…' : 'Load attributes'}
                        </Button>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {(attrOptionsByTemplate[tpl] || []).length === 0 ? (
                        <div className="text-xs text-muted-foreground">No attributes loaded yet.</div>
                      ) : (
                        <div className="border rounded">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted">
                                <th className="p-2 text-left">EF Attribute</th>
                                <th className="p-2 text-left">App Field</th>
                                <th className="p-2 text-left">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attrOptionsByTemplate[tpl].map(attrName => (
                                <tr key={attrName} className="border-t">
                                  <td className="p-2">{attrName}</td>
                                  <td className="p-2">
                                    <select className="border rounded px-2 py-1 text-sm w-full" value={(attrMapByTemplate[tpl]?.[attrName]) || ''} onChange={(e) => setAttrMapByTemplate(prev => ({ ...prev, [tpl]: { ...(prev[tpl] || {}), [attrName]: e.target.value } }))}>
                                      <option value="">—</option>
                                      {APP_FIELDS.map(f => (<option key={f} value={f}>{f}</option>))}
                                    </select>
                                  </td>
                                  <td className="p-2">
                                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setAttrMapByTemplate(prev => { const m = { ...(prev[tpl] || {}) }; delete m[attrName]; return { ...prev, [tpl]: m }; })}>Remove</Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={async () => {
                  try {
                    const tenantId = session?.tenant?.id ?? 'default-tenant';
                    await piStore.upsertMappings(tenantId, { templateToEventType: templateToType as any, attributesByTemplate: attrMapByTemplate as any } as any);
                    toast({ title: 'Saved', description: 'Mappings updated' });
                  } catch (e: any) {
                    toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
                  }
                }}>Save Mappings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle>Sync & Status</CardTitle>
              <CardDescription>Backfill and delta sync Event Frames into app events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={autoDelta} onChange={(e) => setAutoDelta(e.target.checked)} />
                Auto delta sync
              </label>
              <div className="flex items-center gap-2 text-sm">
                <Label>Interval (sec)</Label>
                <Input className="w-28" type="number" min={60} value={intervalSec} onChange={(e) => setIntervalSec(parseInt(e.target.value || '60'))} />
              </div>
              <Button variant="outline" onClick={onSaveSettings}>Save Sync Settings</Button>
            </div>
              <div className="flex gap-4 text-sm">
                <div className="p-3 rounded border bg-white min-w-[200px]">
                  <div className="text-xs text-muted-foreground">PI EF Stored</div>
                  <div className="text-2xl font-semibold">{stats.total}</div>
                </div>
                <div className="p-3 rounded border bg-white flex-1">
                  <div className="text-xs text-muted-foreground">By Template</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {Object.entries(stats.byTemplate).map(([k, v]) => (
                      <span key={k} className="text-xs px-2 py-0.5 rounded bg-gray-100 border">{k}: {v}</span>
                    ))}
                    {Object.keys(stats.byTemplate).length === 0 && <span className="text-xs text-muted-foreground">No data</span>}
                  </div>
                </div>
                <div className="p-3 rounded border bg-white min-w-[240px]">
                  <div className="text-xs text-muted-foreground">Last Watermark</div>
                  <div className="text-sm break-all">{lastWatermark || '—'}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <Label>Start (UTC ISO)</Label>
                  <Input value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
                </div>
                <div>
                  <Label>End (UTC ISO)</Label>
                  <Input value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
                </div>
                <div>
                  <Button onClick={async () => {
                    try {
                      if (scopeType === 'element' && !selectedRoot) throw new Error('Select AF Root in AF tab');
                      if (scopeType === 'database' && !selectedDb) throw new Error('Select AF Database in AF tab');
                      const svc = new PISyncService(client);
                      const tenantId = session?.tenant?.id ?? 'default-tenant';
                      const res = await svc.syncRange({ tenantId, scopeType, scopeId: scopeType === 'element' ? selectedRoot : selectedDb, startTimeUtc: timeStart, endTimeUtc: timeEnd, maxCount: 100 });
                      toast({ title: 'Sync complete', description: `Fetched ${res.fetched}, created ${res.createdAppEvents}` });
                      await refreshStatsAndWatermark();
                    } catch (e: any) {
                      toast({ title: 'Sync failed', description: e.message, variant: 'destructive' });
                    }
                  }}>Backfill Range</Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Note: EF are also stored in `piEvents`. Production events created with source = PI.
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={async () => {
                  try {
                    if (scopeType === 'element' && !selectedRoot) throw new Error('Select AF Root in AF tab');
                    if (scopeType === 'database' && !selectedDb) throw new Error('Select AF Database in AF tab');
                    const tenantId = session?.tenant?.id ?? 'default-tenant';
                    const wm = await piStore.getWatermark(tenantId, scopeType, scopeType === 'element' ? selectedRoot : selectedDb);
                    const start = wm?.lastEndUtc || new Date(Date.now() - 60*60*1000).toISOString();
                    const end = new Date().toISOString();
                    const svc = new PISyncService(client);
                    const res = await svc.syncRange({ tenantId, scopeType, scopeId: scopeType === 'element' ? selectedRoot : selectedDb, startTimeUtc: start, endTimeUtc: end, maxCount: 200 });
                    toast({ title: 'Delta sync complete', description: `Fetched ${res.fetched}, created ${res.createdAppEvents}` });
                    await refreshStatsAndWatermark();
                  } catch (e: any) {
                    toast({ title: 'Delta sync failed', description: e.message, variant: 'destructive' });
                  }
                }}>Delta Sync (from last watermark)</Button>
                <Button variant="outline" onClick={refreshStatsAndWatermark}>Refresh Status</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Full-screen Mapping Manager */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-[1000px] w-[95vw] h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Manage Mappings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label>Filter templates</Label>
                <Input placeholder="Type to filter…" value={manageFilter} onChange={(e) => setManageFilter(e.target.value)} />
              </div>
              <div className="w-72">
                <Label>Template</Label>
                <select className="w-full border rounded px-2 py-1" value={manageSelectedTpl} onChange={(e) => setManageSelectedTpl(e.target.value)}>
                  {efTemplates.filter(t => !manageFilter || t.toLowerCase().includes(manageFilter.toLowerCase())).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="pt-6">
                <Button variant="outline" size="sm" className="h-8" onClick={() => manageSelectedTpl && loadTemplateAttributes(manageSelectedTpl)} disabled={!manageSelectedTpl || !!attrLoadingTpl[manageSelectedTpl]}>{attrLoadingTpl[manageSelectedTpl] ? 'Loading…' : 'Load attributes'}</Button>
              </div>
            </div>

            {manageSelectedTpl ? (
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left w-[40%]">EF Attribute</th>
                      <th className="p-2 text-left w-[40%]">App Field</th>
                      <th className="p-2 text-left w-[20%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(attrOptionsByTemplate[manageSelectedTpl] || []).map(attrName => (
                      <tr key={attrName} className="border-t">
                        <td className="p-2">
                          <div className="font-medium">{attrName}</div>
                          <div className="text-[11px] text-slate-500">Hint: Map text to description or parameter; numeric to quantity/cost; limit/limitType for excursions.</div>
                        </td>
                        <td className="p-2">
                          <select className="border rounded px-2 py-1 text-sm w-full" value={(attrMapByTemplate[manageSelectedTpl]?.[attrName]) || ''} onChange={(e) => setAttrMapByTemplate(prev => ({ ...prev, [manageSelectedTpl]: { ...(prev[manageSelectedTpl] || {}), [attrName]: e.target.value } }))}>
                            <option value="">—</option>
                            {APP_FIELDS.map(f => (<option key={f} value={f}>{f}</option>))}
                          </select>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setAttrMapByTemplate(prev => { const m = { ...(prev[manageSelectedTpl] || {}) }; delete m[attrName]; return { ...prev, [manageSelectedTpl]: m }; })}>Remove</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {((attrOptionsByTemplate[manageSelectedTpl] || []).length === 0) && (
                      <tr><td className="p-3 text-sm text-muted-foreground" colSpan={3}>No attributes loaded. Click "Load attributes" to fetch sample names from PI.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Select a template to view and edit its mappings.</div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setManageOpen(false)}>Close</Button>
              <Button onClick={async () => {
                try {
                  const tenantId = session?.tenant?.id ?? 'default-tenant';
                  await piStore.upsertMappings(tenantId, { templateToEventType: templateToType as any, attributesByTemplate: attrMapByTemplate as any } as any);
                  toast({ title: 'Saved', description: 'Mappings updated' });
                } catch (e: any) {
                  toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
                }
              }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Lightweight EF explorer component for ad-hoc inspection
const Explorer: React.FC<{ client: PIClient; selectedDb: string; selectedRoot: string }>
  = ({ client, selectedDb, selectedRoot }) => {
  const { toast } = useToast();
  const [start, setStart] = useState<string>(new Date(Date.now() - 24*3600*1000).toISOString());
  const [end, setEnd] = useState<string>(new Date().toISOString());
  const [scope, setScope] = useState<'database'|'element'>('element');
  const [grouped, setGrouped] = useState<Record<string, any[]>>({});
  const [attrsByTemplate, setAttrsByTemplate] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const scan = async () => {
    try {
      if (scope === 'element' && !selectedRoot) throw new Error('Select AF Root in AF tab');
      if (scope === 'database' && !selectedDb) throw new Error('Select AF Database in AF tab');
      setLoading(true);
      setPage(0);
      const res = await client.getEventFrames({
        elementWebId: scope === 'element' ? selectedRoot : undefined,
        databaseWebId: scope === 'database' ? selectedDb : undefined,
        startTimeUtc: start,
        endTimeUtc: end,
        maxCount: 10,
        startIndex: 0,
        selectedFields: 'Items.Name;Items.TemplateName;Items.WebId;Items.StartTime;Items.EndTime;Items.PrimaryReferencedElement.WebId;Items.LastModified',
      });
      const items: any[] = res?.Items ?? [];
      const byTpl: Record<string, any[]> = {};
      for (const it of items) {
        const tpl = it.TemplateName || 'Unknown';
        if (!byTpl[tpl]) byTpl[tpl] = [];
        byTpl[tpl].push(it);
      }
      setGrouped(byTpl);
      setHasMore((res?.Links?.Next || '').length > 0 || (items.length || 0) === 10);
      toast({ title: 'Scan complete', description: `${items.length} EF found in range` });

      // Fetch sample attributes per template (first EF of each)
      const attrMap: Record<string, string[]> = {};
      for (const [tpl, list] of Object.entries(byTpl)) {
        if (list.length === 0) continue;
        try {
          const sample = list[0];
          const ar = await client.getEventFrameAttributes(sample.WebId);
          const names = (ar?.Items ?? []).map((a: any) => a.Name);
          attrMap[tpl] = names;
        } catch {
          attrMap[tpl] = [];
        }
      }
      setAttrsByTemplate(attrMap);
    } catch (e: any) {
      toast({ title: 'Scan failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3 items-end">
        <div>
          <Label>Scope</Label>
          <select className="w-full border rounded px-2 py-1" value={scope} onChange={(e) => setScope(e.target.value as any)}>
            <option value="element">Element (Root)</option>
            <option value="database">Database</option>
          </select>
        </div>
        <div>
          <Label>Start (UTC)</Label>
          <Input value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <Label>End (UTC)</Label>
          <Input value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div>
          <Button onClick={scan} disabled={loading}>{loading ? 'Scanning…' : 'Scan EF'}</Button>
        </div>
      </div>
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-left">Template</th>
              <th className="p-2 text-left">Count</th>
              <th className="p-2 text-left">Sample Attributes</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([tpl, list]) => (
              <tr key={tpl} className="border-t align-top">
                <td className="p-2 font-medium">{tpl}</td>
                <td className="p-2">{list.length}</td>
                <td className="p-2">
                  {(attrsByTemplate[tpl] || []).slice(0, 20).join(', ') || '—'}
                </td>
              </tr>
            ))}
            {Object.keys(grouped).length === 0 && (
              <tr><td className="p-2 text-muted-foreground" colSpan={3}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={loading || !hasMore} onClick={async () => {
          try {
            setLoading(true);
            const nextIndex = (page + 1) * 10;
            const res = await client.getEventFrames({
              elementWebId: scope === 'element' ? selectedRoot : undefined,
              databaseWebId: scope === 'database' ? selectedDb : undefined,
              startTimeUtc: start,
              endTimeUtc: end,
              maxCount: 10,
              startIndex: nextIndex,
              selectedFields: 'Items.Name;Items.TemplateName;Items.WebId;Items.StartTime;Items.EndTime;Items.PrimaryReferencedElement.WebId;Items.LastModified',
            });
            const items: any[] = res?.Items ?? [];
            const byTpl = { ...grouped } as Record<string, any[]>;
            for (const it of items) {
              const tpl = it.TemplateName || 'Unknown';
              if (!byTpl[tpl]) byTpl[tpl] = [];
              byTpl[tpl].push(it);
            }
            setGrouped(byTpl);
            setPage(p => p + 1);
            setHasMore((res?.Links?.Next || '').length > 0 || (items.length || 0) === 10);
          } catch (e: any) {
            toast({ title: 'Load more failed', description: e.message, variant: 'destructive' });
          } finally {
            setLoading(false);
          }
        }}>Load more</Button>
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>
    </div>
  );
};

// Historian Tab content (uses provider architecture with current PI provider)
function HistorianTab({ client, selectedElement, selectedAttributes }: { client: PIClient; selectedElement: any; selectedAttributes: any[] }) {
  const { toast } = useToast();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const historian = useMemo(() => {
    const hc = new HistorianClient();
    hc.register(new PIHistorianProvider(client));
    return hc;
  }, [client]);

  const defaultStart = useMemo(() => new Date(Date.now() - 3600 * 1000).toISOString(), []);
  const defaultEnd = useMemo(() => new Date().toISOString(), []);

  const onRun = async (v: any) => {
    try {
      if (!selectedAttributes || selectedAttributes.length === 0) {
        throw new Error('Select an AF element and load attributes in AF tab, then select at least one attribute to view history.');
      }
      setLoading(true);
      // For MVP, use up to first 3 attributes to avoid heavy calls
      const attrs = selectedAttributes.slice(0, 3);
      const provider = new PIHistorianProvider(client);
      const streams = await provider.resolveStreamsByAttributes(attrs);
      if (streams.length === 0) throw new Error('No stream WebIds resolved for the selected attributes.');
      const res = await historian.query({
        provider: 'pi',
        streams,
        mode: v.mode,
        startTimeUtc: v.start,
        endTimeUtc: v.end,
        interval: v.interval,
        intervals: v.intervals,
        includeBad: v.includeBad,
        boundaryType: v.boundaryType,
        summaryTypes: v.summaryTypes,
      } as any);
      setResults(res);
      toast({ title: 'Historian', description: `Fetched ${res.reduce((s, r) => s + (r.points?.length || 0), 0)} points from ${streams.length} stream(s)` });
    } catch (e: any) {
      toast({ title: 'Historian query failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {selectedElement ? `Selected: ${selectedElement?.Name || ''}` : 'Select an AF element in AF tab to choose attributes.'}
      </div>
      {/* Summary and actions */}
      {results && results.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-700">
            {(() => {
              const samples = (results as any[]).reduce((s, r) => s + (r.qualitySummary?.samples || r.points?.length || 0), 0);
              const goodPct = (() => {
                const s = (results as any[]).reduce((acc, r) => acc + ((r.qualitySummary?.pctGood || 0) * (r.qualitySummary?.samples || r.points?.length || 0)), 0);
                return samples ? (s / samples).toFixed(1) : '0.0';
              })();
              const lastTs = (results as any[]).map(r => r.qualitySummary?.lastSampleTime).filter(Boolean).sort().slice(-1)[0] || '';
              return `Samples: ${samples} • %Good (approx): ${goodPct}% • Last: ${lastTs || '—'}`;
            })()}
          </div>
          <div>
            <Button variant="outline" size="sm" onClick={() => {
              try {
                const rows: string[] = [];
                rows.push(['stream','timestamp','value','units','good','questionable','substituted'].join(','));
                for (const r of (results as any[])) {
                  const name = r.stream?.name || r.stream?.path || r.stream?.id;
                  for (const p of (r.points || [])) {
                    rows.push([
                      JSON.stringify(String(name)),
                      JSON.stringify(String(p.timestamp || '')),
                      JSON.stringify(String(p.value ?? '')),
                      JSON.stringify(String(p.units || r.stream?.units || '')),
                      JSON.stringify(String(p.quality?.good ?? '')),
                      JSON.stringify(String(p.quality?.questionable ?? '')),
                      JSON.stringify(String(p.quality?.substituted ?? '')),
                    ].join(','));
                  }
                }
                const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `historian_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              } catch {}
            }}>Export CSV</Button>
          </div>
        </div>
      )}
      <HistorianQueryForm defaultStart={defaultStart} defaultEnd={defaultEnd} onSubmit={onRun} />
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && results && results.length > 0 && (
        <>
          <TimeSeriesChart results={results as any} />
          <TimeSeriesTable results={results as any} />
        </>
      )}
    </div>
  );
}

