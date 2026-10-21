import { EntityManager } from 'typeorm';
import {
  BRANDING_DEFAULTS,
  BRANDING_KEY,
  brandingOf,
} from '../v2/administration/branding/branding-stored';

/** The branding an export carries: product name and colours (pinned on the job at request time). */
export interface ExportBrand {
  appName: string;
  primaryColor: string;
  secondaryColor: string;
}

/** Inline logos PDFKit and ExcelJS can draw (PNG and JPEG). */
const DRAWABLE_LOGO = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The stored application-wide branding (validated field by field) over the defaults; null when none is stored. */
async function storedBranding(manager: EntityManager) {
  const rows = await manager.query<Array<{ value: string }>>(
    `SELECT "value" FROM "app_settings" WHERE "key" = $1 AND "tenant_id" IS NULL AND "user_id" IS NULL`,
    [BRANDING_KEY],
  );
  let parsed: unknown = undefined;
  try {
    parsed = rows[0] ? (JSON.parse(rows[0].value) as unknown) : undefined;
  } catch {
    parsed = undefined;
  }
  return isRecord(parsed)
    ? { ...BRANDING_DEFAULTS, ...brandingOf(parsed) }
    : null;
}

/**
 * Name and colours of the configured branding (owner 21 Oct 2026: report exports follow the branding); null
 * while none is stored, so exports keep their original look (the Marun colours and `assets/marun.png`).
 */
export async function exportBrandOf(
  manager: EntityManager,
): Promise<ExportBrand | null> {
  const branding = await storedBranding(manager);
  if (!branding) return null;
  return {
    appName: branding.appName,
    primaryColor: branding.primaryColor ?? BRANDING_DEFAULTS.primaryColor,
    secondaryColor: branding.secondaryColor ?? BRANDING_DEFAULTS.secondaryColor,
  };
}

/**
 * The configured logo as image bytes when it is an inline PNG or JPEG; null otherwise (no logo, an address
 * on the web — never fetched by the worker — or a format the PDF cannot draw), so the caller falls back.
 */
export async function brandLogoOf(
  manager: EntityManager,
): Promise<Buffer | null> {
  const logoUrl = (await storedBranding(manager))?.logoUrl;
  const match = logoUrl ? DRAWABLE_LOGO.exec(logoUrl) : null;
  return match ? Buffer.from(match[2], 'base64') : null;
}
