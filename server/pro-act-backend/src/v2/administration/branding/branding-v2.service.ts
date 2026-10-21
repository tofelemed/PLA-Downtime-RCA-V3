import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettingsService } from '../../../app-settings/app-settings.service';
import {
  anonymousContext,
  RequestContext,
  runWithRequestContext,
} from '../../../common/context/request-context';
import { Tenant } from '../../../tenant/tenant.entity';
import { announceBranding } from '../../../realtime/settings-notices';
import {
  BrandingPublicV2View,
  BrandingV2Dto,
  BrandingV2View,
} from './branding-v2.dto';
import {
  BRANDING_DEFAULTS,
  BRANDING_FIELDS,
  BRANDING_KEY,
  brandingOf,
} from './branding-stored';
import { AuditLogService } from '../../../audit-log/audit-log.service';
import { changedFields } from '../../../audit-log/settings-change';

export { BRANDING_DEFAULTS, BRANDING_KEY } from './branding-stored';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Application-wide branding on v2, stored in the `branding` app setting the shell already reads. The
 * app-settings policy applies: everyone signed in reads it, only a super administrator writes it
 * (403 SETTING_NOT_WRITABLE).
 */
@Injectable()
export class BrandingV2Service {
  constructor(
    private readonly settings: AppSettingsService,
    private readonly auditLog: AuditLogService,
    @InjectRepository(Tenant) private readonly plants: Repository<Tenant>,
  ) {}

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

  /** The public part of the branding, readable without signing in (the sign-in page, the browser icon). */
  async publicView(): Promise<BrandingPublicV2View> {
    const stored = await this.settings.getAppWideValue(BRANDING_KEY);
    const branding = {
      ...BRANDING_DEFAULTS,
      ...(isRecord(stored) ? brandingOf(stored) : {}),
    };
    return {
      appName: branding.appName,
      appSubtitle: branding.appSubtitle,
      logoUrl: branding.logoUrl,
      logoInitials: branding.logoInitials,
      primaryColor: branding.primaryColor,
      faviconUrl: branding.faviconUrl,
    };
  }

  async save(
    context: RequestContext,
    body: BrandingV2Dto,
  ): Promise<BrandingV2View> {
    const before = await this.get(context);
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
    return this.audited(context, before, 'Changed branding');
  }

  async reset(context: RequestContext): Promise<BrandingV2View> {
    const before = await this.get(context);
    try {
      await this.settings.remove(BRANDING_KEY, context);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
    return this.audited(context, before, 'Reset branding to the defaults');
  }

  /**
   * The branding after a write, with the change audited field by field. Branding is app-wide; the entry is
   * filed under the plant the administrator acts in, where the plant-scoped audit log shows it.
   */
  private async audited(
    context: RequestContext,
    before: BrandingV2View,
    subject: string,
  ): Promise<BrandingV2View> {
    const after = await this.get(context);
    await this.auditLog.recordChange(context, {
      entityType: 'Branding',
      entityId: 'default',
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      subject,
      changes: changedFields(before, after, BRANDING_FIELDS),
    });
    // every plant's users get the new name, logo and colours without a reload; the notices go to
    // every plant, so they are written outside the caller's tenant binding
    await runWithRequestContext(anonymousContext(context.correlationId), () =>
      announceBranding(this.plants.manager),
    );
    return after;
  }
}
