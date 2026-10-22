import type { CreateSiteInput } from '@/api/v2/types/sites';

export interface SiteDraft {
  name: string;
  timezone: string;
  operationalDayStart: string;
}

export type SiteErrors = Partial<Record<keyof SiteDraft, string>>;

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Name required; time zone and day start optional (the server falls back to the plant's), day start as HH:MM. */
export function validateSite(draft: SiteDraft): SiteErrors {
  const errors: SiteErrors = {};
  if (!draft.name.trim()) errors.name = 'Enter a name.';
  if (draft.operationalDayStart.trim() && !HH_MM.test(draft.operationalDayStart.trim())) errors.operationalDayStart = 'Use HH:MM, e.g. 06:00.';
  return errors;
}

/** `POST /v2/sites` body: exactly the fields given (blank optional fields left out). */
export function siteCreateOf(draft: SiteDraft): CreateSiteInput {
  const timezone = draft.timezone.trim();
  const operationalDayStart = draft.operationalDayStart.trim();
  return { name: draft.name.trim(), ...(timezone ? { timezone } : {}), ...(operationalDayStart ? { operationalDayStart } : {}) };
}
