import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { findOrThrow } from '../common/helpers/find-or-throw';
import { RealtimeGateway } from '../realtime.gateway';
import {
  canReadSetting,
  canWriteSetting,
  ownerForKey,
  SettingOwner,
} from './app-settings-access.policy';
import { AppSettings } from './app-settings.entity';

function notAllowed(): ForbiddenException {
  return new ForbiddenException({
    code: 'SETTING_NOT_WRITABLE',
    message: 'This setting cannot be changed by the caller',
  });
}

function serialize(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Key/value settings with an owner (plan 3.11): application-wide rows are read by everyone signed in and
 * written by a SuperAdmin; tenant rows by the tenant's members / administrators; per-user rows
 * (`tabVisibility.<tenant>.<user>`) by their user or SuperAdmin. Unreadable rows behave as missing.
 */
@Injectable()
export class AppSettingsService {
  constructor(
    @InjectRepository(AppSettings)
    private readonly settingsRepository: Repository<AppSettings>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /** Application-wide rows, the caller's own rows and the rows of tenants it belongs to. */
  findAll(context: RequestContext): Promise<AppSettings[]> {
    if (context.isSuperAdmin) {
      return this.settingsRepository.find({ order: { key: 'ASC' } });
    }
    const tenants = memberTenants(context);
    const qb = this.settingsRepository
      .createQueryBuilder('s')
      .where(
        new Brackets((where) => {
          where
            .where('s.tenant_id IS NULL AND s.user_id IS NULL')
            .orWhere('s.user_id = :userId', { userId: context.userId });
          if (tenants.length > 0) {
            where.orWhere(
              's.user_id IS NULL AND s.tenant_id IN (:...tenants)',
              {
                tenants,
              },
            );
          }
        }),
      )
      .orderBy('s.key', 'ASC');
    return qb.getMany();
  }

  async findOne(
    key: string,
    context: RequestContext,
  ): Promise<AppSettings | null> {
    const setting = await this.settingsRepository.findOneBy({ key });
    return setting && canReadSetting(setting, context) ? setting : null;
  }

  async create(
    data: { key: string; value: unknown },
    context: RequestContext,
  ): Promise<AppSettings> {
    const existing = await this.settingsRepository.findOneBy({ key: data.key });
    const owner = existing ?? ownerForKey(data.key);
    this.assertWritable(owner, context);
    const saved = await this.settingsRepository.save(
      this.settingsRepository.create({
        key: data.key,
        value: serialize(data.value),
        tenantId: owner.tenantId,
        userId: owner.userId,
      }),
    );
    this.publish(existing ? 'Updated' : 'Created', saved);
    return saved;
  }

  async update(
    key: string,
    data: { value?: unknown },
    context: RequestContext,
  ): Promise<AppSettings | null> {
    const existing = await this.findOne(key, context);
    if (!existing) return null;
    this.assertWritable(existing, context);
    if (data.value !== undefined) {
      await this.settingsRepository.update(key, {
        value: serialize(data.value),
      });
    }
    const updated = await this.settingsRepository.findOneBy({ key });
    if (updated) this.publish('Updated', updated);
    return updated;
  }

  async remove(key: string, context: RequestContext): Promise<void> {
    const setting = await findOrThrow(
      this.findOne(key, context),
      'AppSetting',
      key,
    );
    this.assertWritable(setting, context);
    await this.settingsRepository.delete(key);
    this.publish('Deleted', { ...setting, value: '' });
  }

  async getValue(key: string, context: RequestContext): Promise<unknown> {
    const setting = await this.findOne(key, context);
    if (!setting) return undefined;
    // JSON values come back parsed; anything else as the stored string
    try {
      return JSON.parse(setting.value) as unknown;
    } catch {
      return setting.value;
    }
  }

  /**
   * An application-wide value (no plant, no user) without a caller: only for values every visitor may see,
   * such as the public part of the branding on the sign-in page.
   */
  async getAppWideValue(key: string): Promise<unknown> {
    const setting = await this.settingsRepository.findOneBy({ key });
    if (!setting || setting.tenantId || setting.userId) return undefined;
    try {
      return JSON.parse(setting.value) as unknown;
    } catch {
      return setting.value;
    }
  }

  setValue(
    key: string,
    value: unknown,
    context: RequestContext,
  ): Promise<AppSettings> {
    return this.create({ key, value }, context);
  }

  private assertWritable(owner: SettingOwner, context: RequestContext): void {
    if (!canWriteSetting(owner, context)) throw notAllowed();
  }

  /** Tenant settings reach the tenant's rooms; per-user and application-wide ones are not broadcast. */
  private publish(event: string, setting: AppSettings): void {
    if (!setting.tenantId || setting.userId) return;
    const payload = event === 'Deleted' ? { key: setting.key } : setting;
    this.realtimeGateway.broadcastEntityEvent(event, 'appSettings', payload, {
      tenantId: setting.tenantId,
    });
  }
}

function memberTenants(context: RequestContext): string[] {
  const ids = context.scopes.map((scope) => scope.tenantId);
  if (context.tenantId) ids.push(context.tenantId);
  return [...new Set(ids)];
}
