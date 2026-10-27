import { useMemo } from 'react';
import { useFailureDictionary } from '@/api/v2/queries/failure-dictionary';
import { useCodeLibrary } from '@/api/v2/queries/reference-data';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useAssetNames, useUserNames } from '@/features/ux-kit/labels';
import type { FactResolvers } from '../model/fact-display';
import { KIND_OF_FIELD } from '../model/failure-dictionary-options';
import type { FailureField } from '../model/failure-form';
import { useEventHubEnv } from '../use-event-hub-env';
import { usePlantFormat } from './use-plant-format';

/** Names, labels and plant time for the revision facts of the event detail (no id or dictionary key reaches the screen). */
export function useFactResolvers(): FactResolvers {
  const env = useEventHubEnv();
  const assets = useAssetNames();
  const users = useUserNames();
  const impact = useCodeLibrary('impact-codes');
  const dictionary = useFailureDictionary();
  const { dateTime, duration } = usePlantFormat();
  const { decimal } = useNumberFormat();
  return useMemo(() => {
    const impactNames = new Map(flattenPages(impact.data?.pages).map((code) => [code.id, `${code.code} · ${code.name}`]));
    const failureNames = new Map(dictionary.entries.map((entry) => [`${entry.kind}:${entry.code}`, entry.name]));
    return {
      failureName: (field: string, code: string) => {
        const kind = KIND_OF_FIELD[field as FailureField];
        return kind ? failureNames.get(`${kind}:${code}`) ?? null : null;
      },
      unitName: env.unitName,
      assetName: assets.nameOf,
      reasonName: env.reasonName,
      impactName: (id: string) => impactNames.get(id) ?? 'Unknown impact code',
      userName: users.nameOf,
      dateTime,
      duration,
      decimal: (value: string, fractionDigits: number) => decimal(value, fractionDigits),
    };
  }, [env.unitName, env.reasonName, assets.nameOf, users.nameOf, impact.data, dictionary.entries, dateTime, duration, decimal]);
}
