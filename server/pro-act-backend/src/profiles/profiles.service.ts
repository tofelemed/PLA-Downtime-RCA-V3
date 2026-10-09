import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { RateTimebase } from '../domain/actuals/actuals.types';
import { CapacityModel, Validity } from '../domain/profiles/profile.types';
import { isValidValidity } from '../domain/profiles/version-window';
import { ProductionProfile } from './entities/production-profile.entity';
import { invalid, notFound } from './profile-errors';
import { recordBaselineChanges } from './profile-events';
import { ProfileReferences } from './profile-references';
import {
  approveVersion,
  nextVersion,
  retireVersion,
  VersionKey,
} from './versioning';

/** Editable content of a profile version (POST body; PATCH of a draft sends any subset). */
export interface ProfileContent {
  quantityUom?: string | null;
  rateTimebase?: RateTimebase | null;
  capacityModel?: CapacityModel;
  productMixConstraints?: Record<string, unknown> | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export type NewProfile = ProfileContent & {
  unitId: string;
  productId: string;
  operatingMode?: string;
};

const WHAT = 'profile';

/**
 * Production profile versions (plan 2.2, PLAN01): drafts per unit/product/operating mode with the next
 * version number, edited with If-Match, approved (no overlap with approved versions; optional
 * supersede of the predecessor) or retired. Approved versions are never edited.
 */
@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(ProductionProfile)
    private readonly profiles: Repository<ProductionProfile>,
    private readonly references: ProfileReferences,
  ) {}

  async create(
    context: RequestContext,
    input: NewProfile,
  ): Promise<ProductionProfile> {
    const tenantId = requireTenantId(context);
    await this.references.assertUnit(context, input.unitId);
    await this.references.assertProduct(context, input.productId);
    const operatingMode = input.operatingMode?.trim() || 'normal';
    const content = storedContent(input);
    return this.profiles.manager.transaction(async (manager) => {
      const key = {
        tenantId,
        unitId: input.unitId,
        productId: input.productId,
        operatingMode,
      };
      const version = await nextVersion(manager, ProductionProfile, key);
      return manager.save(
        manager.create(ProductionProfile, {
          ...content,
          ...key,
          version,
          state: 'draft',
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  /** A profile version of the caller's tenant and unit scope; 404 otherwise. */
  async get(context: RequestContext, id: string): Promise<ProductionProfile> {
    const profile = await scopedQuery(this.profiles, 'p', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('p.id = :id', { id })
      .getOne();
    if (!profile) throw notFound('Profile');
    return profile;
  }

  async update(
    context: RequestContext,
    target: { id: string; expectedRevision: number },
    patch: Partial<ProfileContent>,
  ): Promise<ProductionProfile> {
    const current = await this.get(context, target.id);
    return this.profiles.manager.transaction(async (manager) => {
      const locked = await manager.findOneOrFail(ProductionProfile, {
        where: { id: current.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (locked.state !== 'draft') {
        throw new ConflictException({
          code: 'VERSION_NOT_DRAFT',
          message: 'only a draft profile is edited; create a new version',
        });
      }
      assertRevision(locked.rowVersion, target.expectedRevision);
      const merged = { ...contentOf(locked), ...withoutUndefined(patch) };
      Object.assign(locked, storedContent(merged), {
        updatedBy: context.userId,
      });
      return manager.save(locked);
    });
  }

  async approve(
    context: RequestContext,
    id: string,
    supersede: boolean,
  ): Promise<ProductionProfile> {
    const profile = await this.get(context, id);
    if (!profile.quantityUom || !profile.rateTimebase) {
      throw invalid(
        'PROFILE_INCOMPLETE',
        'quantityUom and rateTimebase are required before approval',
      );
    }
    return this.profiles.manager.transaction(async (manager) => {
      const result = await approveVersion(
        manager,
        ProductionProfile,
        { id, key: keyOf(profile), supersede, actorId: context.userId },
        WHAT,
      );
      await recordBaselineChanges(manager, [
        { row: result.approved, change: 'approved' },
        ...(result.superseded
          ? [{ row: result.superseded, change: 'superseded' as const }]
          : []),
      ]);
      return result.approved;
    });
  }

  async retire(
    context: RequestContext,
    id: string,
  ): Promise<ProductionProfile> {
    const profile = await this.get(context, id);
    return this.profiles.manager.transaction(async (manager) => {
      const retired = await retireVersion(
        manager,
        ProductionProfile,
        { id: profile.id, actorId: context.userId },
        WHAT,
      );
      if (profile.state === 'approved') {
        await recordBaselineChanges(manager, [
          { row: retired, change: 'retired' },
        ]);
      }
      return retired;
    });
  }
}

function keyOf(profile: ProductionProfile): VersionKey {
  return {
    tenantId: profile.tenantId,
    unitId: profile.unitId,
    productId: profile.productId,
    operatingMode: profile.operatingMode,
  };
}

/** Parsed, validated validity (422 `INVALID_EFFECTIVE_DATES` when `to` is not after `from`). */
export function validityOf(content: {
  effectiveFrom: string;
  effectiveTo?: string | null;
}): Validity {
  const validity = {
    from: new Date(content.effectiveFrom),
    to: content.effectiveTo ? new Date(content.effectiveTo) : null,
  };
  if (!isValidValidity(validity)) {
    throw invalid(
      'INVALID_EFFECTIVE_DATES',
      'effectiveTo must be after effectiveFrom',
    );
  }
  return validity;
}

function storedContent(content: ProfileContent): Partial<ProductionProfile> {
  const validity = validityOf(content);
  return {
    quantityUom: content.quantityUom?.trim() || null,
    rateTimebase: content.rateTimebase ?? null,
    capacityModel: content.capacityModel ?? 'single_stream',
    productMixConstraints: content.productMixConstraints ?? null,
    effectiveFrom: validity.from,
    effectiveTo: validity.to,
  };
}

function contentOf(profile: ProductionProfile): ProfileContent {
  return {
    quantityUom: profile.quantityUom,
    rateTimebase: profile.rateTimebase,
    capacityModel: profile.capacityModel,
    productMixConstraints: profile.productMixConstraints,
    effectiveFrom: profile.effectiveFrom.toISOString(),
    effectiveTo: profile.effectiveTo ? profile.effectiveTo.toISOString() : null,
  };
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
