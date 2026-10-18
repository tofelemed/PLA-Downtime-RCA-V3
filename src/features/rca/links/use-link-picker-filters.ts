import { useState } from 'react';
import type { RcaLinkView } from '@/api/v2/types/rca';
import { defaultPickerWindow, triggerOfLinks, type LinkPickerFilters } from '../model/link-picker';

/**
 * Filters shared by the link pickers. Until the user changes one, the window is the default: 30 days
 * around the case's trigger event (its first linked event) once the links are loaded, else the last 30 days.
 */
export function useLinkPickerFilters(links: readonly RcaLinkView[] | undefined, timeZone: string) {
  const [edited, setEdited] = useState<LinkPickerFilters | null>(null);
  const trigger = links ? triggerOfLinks(links) : null;
  const value: LinkPickerFilters = edited ?? { unitId: '', reasonCodeId: '', q: '', ...defaultPickerWindow(trigger?.start ?? null, new Date(), timeZone) };
  return { value, onChange: setEdited };
}
