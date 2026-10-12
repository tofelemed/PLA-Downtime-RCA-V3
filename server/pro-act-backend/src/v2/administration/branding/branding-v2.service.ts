import { Injectable, NotFoundException } from '@nestjs/common';
import { AppSettingsService } from '../../../app-settings/app-settings.service';
import { RequestContext } from '../../../common/context/request-context';
import { BrandingV2Dto, BrandingV2View } from './branding-v2.dto';

/** App-settings key the shell reads the branding from (`BrandingService` in the frontend). */
export const BRANDING_KEY = 'branding';

/** Defaults of the shell (`src/services/BrandingService.ts` DEFAULT_BRANDING), kept identical. */
export const BRANDING_DEFAULTS: BrandingV2Dto = {
  appName: 'Unified APM',
  appSubtitle: 'Asset Performance Management',
  logoInitials: 'UA',
  primaryColor: '#2563eb',
  secondaryColor: '#ec4899',
  logoSize: 32,
  logoObjectFit: 'contain',
  logoBorderRadius: 4,
  logoContainerSize: 40,
  logoContainerRadius: 12,
  logoContainerPadding: 0,
  logoBackgroundOpacity: 1,
};

const FIELDS = Object.keys({
  ...BRANDING_DEFAULTS,
  logoUrl: '',
  faviconUrl: '',
}) as Array<keyof BrandingV2Dto>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Only the known branding fields of a stored value (older values carry `id`, `updatedBy`, …). */
function brandingOf(stored: Record<string, unknown>): Partial<BrandingV2Dto> {
  const picked: Record<string, unknown> = {};
  for (const field of FIELDS) {
    if (
      stored[field] !== undefined &&
      stored[field] !== null &&
      stored[field] !== ''
    )
      picked[field] = stored[field];
  }
  return picked;
}

/**
 * Application-wide branding on v2, stored in the `branding` app setting the shell already reads. The
 * app-settings policy applies: everyone signed in reads it, only a super administrator writes it
 * (403 SETTING_NOT_WRITABLE).
 */
@Injectable()
export class BrandingV2Service {
  constructor(private readonly settings: AppSettingsService) {}

  async get(context: RequestContext): Promise<BrandingV2View> {
    const stored = await this.settings.getValue(BRANDING_KEY, context);
    if (!isRecord(stored))
      return { ...BRANDING_DEFAULTS, isStored: false, updatedAt: null };
    const updatedAt =
      typeof stored.updatedAt === 'string' ? stored.updatedAt : null;
    return {
      ...BRANDING_DEFAULTS,
      ...brandingOf(stored),
      isStored: true,
      updatedAt,
    };
  }

  async save(
    context: RequestContext,
    body: BrandingV2Dto,
  ): Promise<BrandingV2View> {
    await this.settings.setValue(
      BRANDING_KEY,
      {
        ...body,
        id: 'default',
        updatedAt: new Date().toISOString(),
        updatedBy: context.userId,
      },
      context,
    );
    return this.get(context);
  }

  async reset(context: RequestContext): Promise<BrandingV2View> {
    try {
      await this.settings.remove(BRANDING_KEY, context);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
    return this.get(context);
  }
}
