import { useMemo } from 'react';
import type { EventEvidencePackageView } from '@/api/v2/types/rca';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { useAssetNames, useUnitNames } from '@/features/ux-kit/labels';
import { type DigitSystem, useCalendarPreference } from '@/lib/dates';
import type { EventCaseFacts } from '../model/event-case-prefill';
import { useRcaFormat } from '../use-rca-format';

const durationText = (seconds: number | null | undefined, digits: DigitSystem) =>
  seconds === null || seconds === undefined ? null : formatDuration(seconds, 'long', digits);

/**
 * The investigated event as display text (unit and asset names, plant-time start and end, duration and
 * reason), from the evidence package the page already loads; null until the package and names are loaded.
 */
export function useEventCaseFacts(evidence: EventEvidencePackageView | undefined): EventCaseFacts | null {
  const units = useUnitNames();
  const assets = useAssetNames();
  const { dateTime } = useRcaFormat();
  const { digits } = useCalendarPreference();
  return useMemo(() => {
    if (!evidence || units.isLoading || assets.isLoading) return null;
    const { event, causeCodes } = evidence;
    return {
      unitName: units.nameOf(event.unitId),
      assetName: event.assetId ? assets.nameOf(event.assetId) : null,
      reasonName: causeCodes.reasonCode?.name?.trim() || null,
      start: dateTime(event.start),
      end: event.end ? dateTime(event.end) : null,
      duration: durationText(event.durationSeconds, digits),
    };
  }, [evidence, units, assets, dateTime, digits]);
}
