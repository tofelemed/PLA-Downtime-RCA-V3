import { EntityManager } from 'typeorm';
import { exportBrandOf } from './export-brand';
import { defaultSiteOf } from '../close/close-calendar';
import {
  CALENDAR_SYSTEMS,
  CalendarSystem,
  DEFAULT_CALENDAR_SYSTEM,
  DEFAULT_DIGIT_SYSTEM,
  DIGIT_SYSTEMS,
  DigitSystem,
} from '../tenant/tenant-display-settings';
import {
  DEFAULT_PDF_CURRENCY,
  ExportPresentation,
  PdfCurrency,
} from './pdf/pdf-model';

interface TenantDisplayRow {
  name: string;
  timezone: string | null;
  calendar_system: string;
  digits: string;
}

const calendarOf = (value: string): CalendarSystem =>
  (CALENDAR_SYSTEMS as readonly string[]).includes(value)
    ? (value as CalendarSystem)
    : DEFAULT_CALENDAR_SYSTEM;

const digitsOf = (value: string): DigitSystem =>
  (DIGIT_SYSTEMS as readonly string[]).includes(value)
    ? (value as DigitSystem)
    : DEFAULT_DIGIT_SYSTEM;

/**
 * The presentation a PDF export is pinned with (CLAUDE.md: plant settings apply everywhere): the plant
 * name, its clock (the default site's published calendar zone, else the plant's own, else UTC), calendar
 * and digits, and the display currency asked for (USD by default).
 */
export async function presentationOf(
  manager: EntityManager,
  tenantId: string,
  currency: PdfCurrency | undefined,
): Promise<ExportPresentation> {
  const rows: TenantDisplayRow[] = await manager.query(
    `SELECT "name", "timezone", "calendar_system", "digits" FROM "tenants" WHERE "id" = $1`,
    [tenantId],
  );
  const tenant = rows[0];
  const site = await defaultSiteOf(manager, tenantId);
  return {
    plantName: tenant?.name ?? tenantId,
    timezone: site?.timezone ?? tenant?.timezone ?? null,
    calendar: calendarOf(tenant?.calendar_system ?? ''),
    digits: digitsOf(tenant?.digits ?? ''),
    currency: currency ?? DEFAULT_PDF_CURRENCY,
    brand: await exportBrandOf(manager),
  };
}
