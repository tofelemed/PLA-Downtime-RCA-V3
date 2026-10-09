import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { assertTenantWide } from '../periods/period-scope';
import { FeatureFlag } from './feature-flag.entity';
import {
  FEATURE_FLAG_DEFAULTS,
  FeatureFlagKey,
  isFeatureFlagKey,
} from './feature-flag-keys';

export interface FeatureFlagState {
  key: FeatureFlagKey;
  enabled: boolean;
  /** false = registry default (no tenant row) */
  overridden: boolean;
  updatedAt: string | null;
}

/** Tenant feature flags (plan 3.1): registry defaults overlaid with the tenant's rows. */
@Injectable()
export class FeatureFlagsService {
  constructor(
    @InjectRepository(FeatureFlag)
    private readonly flags: Repository<FeatureFlag>,
  ) {}

  async list(ctx: RequestContext): Promise<FeatureFlagState[]> {
    const rows = await scopedQuery(this.flags, 'f', { context: ctx })
      .select(['f.key', 'f.enabled', 'f.updatedAt'])
      .getMany();
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return (Object.keys(FEATURE_FLAG_DEFAULTS) as FeatureFlagKey[]).map(
      (key) => {
        const row = byKey.get(key);
        return {
          key,
          enabled: row ? row.enabled : FEATURE_FLAG_DEFAULTS[key],
          overridden: row !== undefined,
          updatedAt: row ? row.updatedAt.toISOString() : null,
        };
      },
    );
  }

  /** One flag of a tenant (registry default when the tenant has no row); used by guards. */
  async isEnabled(tenantId: string, key: FeatureFlagKey): Promise<boolean> {
    const row = await this.flags.findOne({
      where: { tenantId, key },
      select: { id: true, enabled: true },
    });
    return row ? row.enabled : FEATURE_FLAG_DEFAULTS[key];
  }

  /** Sets one flag for the whole tenant (tenant-wide grant required); unknown keys are 404. */
  async set(
    ctx: RequestContext,
    key: string,
    enabled: boolean,
  ): Promise<FeatureFlagState> {
    if (!isFeatureFlagKey(key)) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Unknown feature flag ${key}`,
      });
    }
    assertTenantWide(ctx, 'A feature flag');
    const tenantId = requireTenantId(ctx);
    await this.flags
      .createQueryBuilder()
      .insert()
      .into(FeatureFlag)
      .values({
        tenantId,
        key,
        enabled,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        rowVersion: 1,
      })
      .orUpdate(['enabled', 'updated_by', 'updated_at'], ['tenant_id', 'key'])
      .execute();
    const state = (await this.list(ctx)).find((flag) => flag.key === key);
    return state as FeatureFlagState;
  }
}
