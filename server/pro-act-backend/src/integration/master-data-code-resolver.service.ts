import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TenantCodeCache {
  reasonCodes: ReasonCode[];
  impactCodes: ImpactCode[];
  oeeCodes: OEECode[];
  loadedAt: number;
}

@Injectable()
export class MasterDataCodeResolverService {
  private readonly logger = new Logger(MasterDataCodeResolverService.name);
  private readonly cache = new Map<string, TenantCodeCache>();
  private readonly ttlMs = 5 * 60 * 1000;

  constructor(
    @InjectRepository(ReasonCode)
    private readonly reasonCodeRepository: Repository<ReasonCode>,
    @InjectRepository(ImpactCode)
    private readonly impactCodeRepository: Repository<ImpactCode>,
    @InjectRepository(OEECode)
    private readonly oeeCodeRepository: Repository<OEECode>,
  ) {}

  isUuid(value: string): boolean {
    return UUID_REGEX.test(value);
  }

  private normalize(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private async loadTenantCache(tenantId: string): Promise<TenantCodeCache> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.ttlMs) {
      return cached;
    }

    const [reasonCodes, impactCodes, oeeCodes] = await Promise.all([
      this.reasonCodeRepository.find({ where: { tenantId } }),
      this.impactCodeRepository.find({ where: { tenantId } }),
      this.oeeCodeRepository.find({ where: { tenantId } }),
    ]);

    const entry: TenantCodeCache = {
      reasonCodes,
      impactCodes,
      oeeCodes,
      loadedAt: Date.now(),
    };
    this.cache.set(tenantId, entry);
    return entry;
  }

  private matchRecord<T extends { id: string; code?: string; name?: string }>(
    records: T[],
    rawValue: string,
  ): string | undefined {
    if (!rawValue) return undefined;
    if (this.isUuid(rawValue)) return rawValue;

    const normalized = rawValue.toLowerCase();

    const exact = records.find(
      (r) =>
        r.code?.toLowerCase() === normalized ||
        r.name?.toLowerCase() === normalized,
    );
    if (exact) return exact.id;

    const partial = records.find(
      (r) =>
        r.name?.toLowerCase().includes(normalized) ||
        normalized.includes(r.name?.toLowerCase() || '') ||
        r.code?.toLowerCase().includes(normalized),
    );
    return partial?.id;
  }

  async resolveReasonCodeId(value: unknown, tenantId: string): Promise<string | undefined> {
    const raw = this.normalize(value);
    if (!raw) return undefined;
    if (this.isUuid(raw)) return raw;

    const cache = await this.loadTenantCache(tenantId);
    const resolved = this.matchRecord(cache.reasonCodes, raw);
    if (!resolved) {
      this.logger.debug(`Reason code not resolved for "${raw}" (tenant ${tenantId})`);
    }
    return resolved;
  }

  async resolveImpactCodeId(value: unknown, tenantId: string): Promise<string | undefined> {
    const raw = this.normalize(value);
    if (!raw) return undefined;
    if (this.isUuid(raw)) return raw;

    const cache = await this.loadTenantCache(tenantId);
    const resolved = this.matchRecord(cache.impactCodes, raw);
    if (!resolved) {
      this.logger.debug(`Impact code not resolved for "${raw}" (tenant ${tenantId})`);
    }
    return resolved;
  }

  async resolveOeeCodeId(value: unknown, tenantId: string): Promise<string | undefined> {
    const raw = this.normalize(value);
    if (!raw) return undefined;
    if (this.isUuid(raw)) return raw;

    const cache = await this.loadTenantCache(tenantId);
    const resolved = this.matchRecord(cache.oeeCodes, raw);
    if (!resolved) {
      this.logger.debug(`OEE code not resolved for "${raw}" (tenant ${tenantId})`);
    }
    return resolved;
  }

  /** Resolve PI-mapped code fields from names/codes to DB UUIDs */
  async resolveMappedCodeFields(
    fields: Record<string, any>,
    tenantId: string,
  ): Promise<Record<string, any>> {
    const resolved = { ...fields };

    if (resolved.reasonCodeId !== undefined) {
      const id = await this.resolveReasonCodeId(resolved.reasonCodeId, tenantId);
      if (id) resolved.reasonCodeId = id;
      else delete resolved.reasonCodeId;
    }

    if (resolved.impactCodeId !== undefined) {
      const id = await this.resolveImpactCodeId(resolved.impactCodeId, tenantId);
      if (id) resolved.impactCodeId = id;
      else delete resolved.impactCodeId;
    }

    if (resolved.oeeCodeId !== undefined) {
      const id = await this.resolveOeeCodeId(resolved.oeeCodeId, tenantId);
      if (id) resolved.oeeCodeId = id;
      else delete resolved.oeeCodeId;
    }

    return resolved;
  }
}
