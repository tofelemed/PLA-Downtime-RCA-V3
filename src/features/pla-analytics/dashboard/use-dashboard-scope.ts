import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import type { AnalyticsScope } from '../model/analytics-scope';
import { dashboardScope, presetKeyOf, type DashboardNode, type DashboardPresetKey } from '../model/dashboard-scope';

const DEFAULT_KEY: DashboardPresetKey = '7d';

export interface DashboardScopeState {
  key: DashboardPresetKey;
  setKey: (key: DashboardPresetKey) => void;
  scope: AnalyticsScope;
  node: DashboardNode;
  /** an organisation is chosen without a plant: there is no plant to show */
  orgOnly: boolean;
}

/** The dashboard's period (`?window=`) and hierarchy node (the plant selection), as one analytics scope. */
export function useDashboardScope(): DashboardScopeState {
  const [params, setParams] = useSearchParams();
  const { selection } = usePlantSelection();
  const key = presetKeyOf(params.get('window'));
  const unitId = selection?.unit?.id;
  const assetId = selection?.asset?.id;
  const node = useMemo<DashboardNode>(() => ({ ...(unitId ? { unitId } : {}), ...(assetId ? { assetId } : {}) }), [unitId, assetId]);
  const scope = useMemo(() => dashboardScope(key, node), [key, node]);
  const setKey = (next: DashboardPresetKey) => setParams(next === DEFAULT_KEY ? {} : { window: next }, { replace: true });
  return { key, setKey, scope, node, orgOnly: Boolean(selection?.organization) && !selection?.tenant };
}
