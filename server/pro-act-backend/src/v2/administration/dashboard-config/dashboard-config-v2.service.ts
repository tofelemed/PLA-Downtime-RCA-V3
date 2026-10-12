import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { DashboardConfiguration } from '../../../dashboard-configuration/dashboard-configuration.entity';
import {
  DashboardConfigApiPayload,
  DashboardConfigApiRecord,
} from '../../../dashboard-configuration/dashboard-configuration.mapper';
import { DashboardConfigurationService } from '../../../dashboard-configuration/dashboard-configuration.service';
import { PlaceNamesService } from '../common/place-names.service';
import { UserDirectoryService } from '../users/user-directory.service';
import {
  DASHBOARD_DEFAULTS,
  DASHBOARD_SECTIONS,
  DashboardSection,
} from './dashboard-config-defaults';
import {
  DashboardConfigV2View,
  DashboardSettingsDto,
} from './dashboard-config-v2.dto';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** One stored section (a JSON string) over its defaults; unreadable JSON falls back to the defaults. */
function sectionOf<K extends DashboardSection>(
  raw: string | undefined,
  key: K,
): DashboardSettingsDto[K] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isRecord(parsed)
      ? { ...DASHBOARD_DEFAULTS[key], ...parsed }
      : DASHBOARD_DEFAULTS[key];
  } catch {
    return DASHBOARD_DEFAULTS[key];
  }
}

function settingsOf(record: DashboardConfigApiRecord): DashboardSettingsDto {
  const settings = { ...DASHBOARD_DEFAULTS };
  for (const key of DASHBOARD_SECTIONS) {
    Object.assign(settings, { [key]: sectionOf(record[key], key) });
  }
  return settings;
}

/**
 * The plant's dashboard settings on v2, stored where the v1 plan dashboard reads them
 * (`dashboard_configurations`, active row of the tenant). Reading never writes: without a stored row the
 * defaults are returned (`isStored: false`).
 */
@Injectable()
export class DashboardConfigV2Service {
  constructor(
    private readonly legacy: DashboardConfigurationService,
    @InjectRepository(DashboardConfiguration)
    private readonly rows: Repository<DashboardConfiguration>,
    private readonly places: PlaceNamesService,
    private readonly directory: UserDirectoryService,
  ) {}

  async get(context: RequestContext): Promise<DashboardConfigV2View> {
    const tenantId = requireTenantId(context);
    const record = await this.legacy.findActiveByTenant(tenantId);
    if (!record) {
      return {
        settings: DASHBOARD_DEFAULTS,
        isStored: false,
        updatedAt: null,
        updatedByName: null,
      };
    }
    const names = await this.directory.nameMap(tenantId, [
      record.lastModifiedBy,
    ]);
    return {
      settings: settingsOf(record),
      isStored: true,
      updatedAt: record.updatedAt
        ? new Date(record.updatedAt).toISOString()
        : null,
      updatedByName: record.lastModifiedBy
        ? (names.get(record.lastModifiedBy) ?? null)
        : null,
    };
  }

  async save(
    context: RequestContext,
    settings: DashboardSettingsDto,
  ): Promise<DashboardConfigV2View> {
    const tenantId = requireTenantId(context);
    const current = await this.legacy.findActiveByTenant(tenantId);
    const payload: DashboardConfigApiPayload = {
      tenantId,
      organizationId: (await this.places.organizationOf(tenantId)) ?? undefined,
      isActive: true,
      version: (current?.version ?? 0) + 1,
      lastModifiedBy: context.userId,
      lastModifiedAt: new Date().toISOString(),
    };
    for (const key of DASHBOARD_SECTIONS)
      payload[key] = JSON.stringify(settings[key]);
    if (current) await this.legacy.update(current.id, payload);
    else await this.legacy.create(payload);
    return this.get(context);
  }

  /** Back to the defaults: the plant's stored settings are removed. */
  async reset(context: RequestContext): Promise<DashboardConfigV2View> {
    const tenantId = requireTenantId(context);
    await this.rows.delete({ tenantId });
    return this.get(context);
  }
}
