import { useMemo } from 'react';
import { useCodeLibrary } from '@/api/v2/queries/reference-data';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useAssetNames, useUserNames } from '@/features/ux-kit/labels';
import type { FactResolvers } from '../model/fact-display';
import { useEventHubEnv } from '../use-event-hub-env';
import { usePlantFormat } from './use-plant-format';

/** Names, labels and plant time for the revision facts of the event detail (no id reaches the screen). */
export function useFactResolvers(): FactResolvers {
  const env = useEventHubEnv();
  const assets = useAssetNames();
  const users = useUserNames();
  const impact = useCodeLibrary('impact-codes');
  const { dateTime } = usePlantFormat();
  return useMemo(() => {
    const impactNames = new Map(flattenPages(impact.data?.pages).map((code) => [code.id, `${code.code} · ${code.name}`]));
    return {
      unitName: env.unitName,
      assetName: assets.nameOf,
      reasonName: env.reasonName,
      impactName: (id: string) => impactNames.get(id) ?? 'Unknown impact code',
      userName: users.nameOf,
      dateTime,
    };
  }, [env.unitName, env.reasonName, assets.nameOf, users.nameOf, impact.data, dateTime]);
}
