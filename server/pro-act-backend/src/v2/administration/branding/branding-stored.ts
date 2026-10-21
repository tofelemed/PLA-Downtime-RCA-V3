import {
  BrandingV2Dto,
  HEX_COLOR,
  IMAGE_MAX_LENGTH,
  IMAGE_SOURCE,
  LOGO_FITS,
} from './branding-v2.dto';

/** App-settings key the shell reads the branding from (the shell reads it through `GET /v2/branding`). */
export const BRANDING_KEY = 'branding';

/** The branding while none is stored (also what a stored value falls back to field by field). */
export const BRANDING_DEFAULTS = {
  appName: 'Traverse Forge',
  appSubtitle: 'Production loss accounting',
  logoInitials: 'TF',
  primaryColor: '#2563eb',
  secondaryColor: '#ec4899',
  logoSize: 32,
  logoObjectFit: 'contain',
  logoBorderRadius: 4,
  logoContainerSize: 40,
  logoContainerRadius: 12,
  logoContainerPadding: 0,
  logoBackgroundOpacity: 1,
} satisfies BrandingV2Dto;

type Field = keyof BrandingV2Dto;

const text = (max: number, empty: boolean) => (value: unknown) =>
  typeof value === 'string' &&
  value.length <= max &&
  (empty || value.trim() !== '');
const int = (min: number, max: number) => (value: unknown) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;
const color = (value: unknown) =>
  typeof value === 'string' && HEX_COLOR.test(value);
const image = (value: unknown) =>
  typeof value === 'string' &&
  value.length <= IMAGE_MAX_LENGTH &&
  IMAGE_SOURCE.test(value);

/**
 * What a stored branding field may hold — the rules of `BrandingV2Dto`, applied again on read (settings audit,
 * 21 Oct 2026): a value stored by an older route or by hand never reaches a browser unchecked. The subtitle
 * and initials may be stored empty: an administrator cleared them on purpose.
 */
const RULES: Readonly<Record<Field, (value: unknown) => boolean>> = {
  appName: text(80, false),
  appSubtitle: text(120, true),
  logoInitials: text(4, true),
  logoUrl: image,
  faviconUrl: image,
  primaryColor: color,
  secondaryColor: color,
  logoSize: int(8, 256),
  logoObjectFit: (value) =>
    typeof value === 'string' &&
    (LOGO_FITS as readonly string[]).includes(value),
  logoBorderRadius: int(0, 128),
  logoContainerSize: int(8, 256),
  logoContainerRadius: int(0, 128),
  logoContainerPadding: int(0, 64),
  logoBackgroundOpacity: (value) =>
    typeof value === 'number' && value >= 0 && value <= 1,
};

export const BRANDING_FIELDS = Object.keys(RULES) as Field[];

/** The valid branding fields of a stored value (older values also carry `id`, `updatedBy`, …). */
export function brandingOf(
  stored: Record<string, unknown>,
): Partial<BrandingV2Dto> {
  const picked: Record<string, unknown> = {};
  for (const field of BRANDING_FIELDS) {
    if (RULES[field](stored[field])) picked[field] = stored[field];
  }
  return picked;
}
