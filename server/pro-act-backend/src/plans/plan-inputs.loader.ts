import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarService } from '../calendar/calendar.service';
import { ShiftInstance } from '../calendar/entities/shift-instance.entity';
import { LeafRates, PlanLeaf, SliceInput } from '../domain/plans/plan.types';
import { VersionRef } from '../domain/profiles/profile.types';
import { ratePerSecond } from '../domain/profiles/rate-math';
import { versionAt } from '../domain/profiles/version-window';
import { ProductionProfile } from '../profiles/entities/production-profile.entity';
import { UnitProductRate } from '../profiles/entities/unit-product-rate.entity';
import { ProfileResolutionService } from '../profiles/profile-resolution.service';
import { PlanProductSlice } from './entities/plan-product-slice.entity';
import { PlanWindow } from './plan-content';

type ProfileRef = VersionRef & { row: ProductionProfile };
type RateRef = VersionRef & { row: UnitProductRate };

/** Approved profiles of one slice and their planning / sustained rates over the plan window. */
interface SliceRates {
  profiles: ProfileRef[];
  rates: Map<string, { planning: RateRef[]; sustained: RateRef[] }>;
}

const refOf = <
  T extends {
    id: string;
    version: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  },
>(
  row: T,
) => ({
  id: row.id,
  version: row.version,
  from: row.effectiveFrom,
  to: row.effectiveTo,
  row,
});

/**
 * Inputs of the period generator (plan 2.3 step 2): the unit's stored shift instances over the plan
 * window (clipped to it) as leaves, and the approved profiles and planning / sustained rates of each
 * slice over the window, loaded once per slice and resolved per leaf in memory (no query per leaf).
 */
@Injectable()
export class PlanInputsLoader {
  constructor(
    private readonly calendar: CalendarService,
    @InjectRepository(ProductionProfile)
    private readonly profiles: Repository<ProductionProfile>,
    private readonly resolution: ProfileResolutionService,
  ) {}

  async leaves(
    tenantId: string,
    unitId: string,
    window: PlanWindow,
  ): Promise<PlanLeaf[]> {
    const instances = await this.calendar.instancesIn(tenantId, unitId, {
      start: window.from,
      end: window.to,
    });
    return instances.map((instance) => toLeaf(instance, window));
  }

  /** A pure `ratesAt(slice, leaf)` lookup over the approved versions loaded for every slice. */
  async ratesLookup(
    tenantId: string,
    unitId: string,
    slices: readonly PlanProductSlice[],
    window: PlanWindow,
  ): Promise<(slice: SliceInput, leaf: PlanLeaf) => LeafRates> {
    const bySlice = new Map<string, SliceRates>();
    for (const slice of slices) {
      bySlice.set(
        slice.id,
        await this.loadSlice(tenantId, unitId, slice, window),
      );
    }
    return (slice, leaf) => {
      const loaded = bySlice.get(slice.key);
      return loaded ? leafRates(loaded, slice.productId, leaf) : noRates();
    };
  }

  private async loadSlice(
    tenantId: string,
    unitId: string,
    slice: PlanProductSlice,
    window: PlanWindow,
  ): Promise<SliceRates> {
    const rows = await this.approvedProfiles(tenantId, unitId, slice, window);
    const rates = new Map<
      string,
      { planning: RateRef[]; sustained: RateRef[] }
    >();
    for (const profile of rows) {
      const approved = await this.resolution.approvedRates(profile.id, window);
      rates.set(profile.id, {
        planning: approved.filter((r) => r.rateKind === 'planning').map(refOf),
        sustained: approved
          .filter((r) => r.rateKind === 'sustained')
          .map(refOf),
      });
    }
    return { profiles: rows.map(refOf), rates };
  }

  /** Approved profiles of the slice's product and operating mode overlapping the window. */
  private async approvedProfiles(
    tenantId: string,
    unitId: string,
    slice: PlanProductSlice,
    window: PlanWindow,
  ): Promise<ProductionProfile[]> {
    const mode = await this.operatingMode(slice);
    return this.profiles
      .createQueryBuilder('p')
      .where(
        'p.tenantId = :tenantId AND p.unitId = :unitId AND p.productId = :productId',
        {
          tenantId,
          unitId,
          productId: slice.productId,
        },
      )
      .andWhere(`p.operatingMode = :mode AND p.state = 'approved'`, { mode })
      .andWhere(
        'p.effectiveFrom < :to AND (p.effectiveTo IS NULL OR p.effectiveTo > :from)',
        {
          from: window.from,
          to: window.to,
        },
      )
      .getMany();
  }

  /** A pinned profile gives the operating mode; otherwise `normal`. */
  private async operatingMode(slice: PlanProductSlice): Promise<string> {
    if (!slice.profileId) return 'normal';
    const pinned = await this.profiles.findOneBy({ id: slice.profileId });
    return pinned?.operatingMode ?? 'normal';
  }
}

function toLeaf(instance: ShiftInstance, window: PlanWindow): PlanLeaf {
  const start = new Date(
    Math.max(instance.utcStart.getTime(), window.from.getTime()),
  );
  const end = new Date(
    Math.min(instance.utcEnd.getTime(), window.to.getTime()),
  );
  return {
    shiftInstanceId: instance.id,
    calendarVersionId: instance.calendarVersionId,
    localDate: instance.localDate,
    shiftName: instance.shiftName,
    start,
    end,
    isExcluded: instance.isExcluded,
    exclusionKind: instance.exclusionKind,
    offsetChanges: instance.utcOffsetStart !== instance.utcOffsetEnd,
    clipped:
      start.getTime() !== instance.utcStart.getTime() ||
      end.getTime() !== instance.utcEnd.getTime(),
  };
}

function noRates(): LeafRates {
  return {
    profileId: null,
    quantityUom: null,
    planning: null,
    sustained: null,
    recipeShare: null,
    rateChangesInside: false,
  };
}

/** Versions in force at the leaf start; a version boundary strictly inside the leaf is reported. */
function leafRates(
  loaded: SliceRates,
  productId: string,
  leaf: PlanLeaf,
): LeafRates {
  const profile = versionAt(loaded.profiles, leaf.start);
  if (!profile) return noRates();
  const rates = loaded.rates.get(profile.id) ?? { planning: [], sustained: [] };
  const planning = versionAt(rates.planning, leaf.start);
  const sustained = versionAt(rates.sustained, leaf.start);
  const resolved = (rate: RateRef | null) =>
    rate ? { id: rate.id, perSecond: ratePerSecond(rate.row).toFixed() } : null;
  return {
    profileId: profile.id,
    quantityUom: profile.row.quantityUom,
    planning: resolved(planning),
    sustained: resolved(sustained),
    recipeShare: recipeShare(profile.row, productId),
    rateChangesInside: [profile, ...rates.planning, ...rates.sustained].some(
      (v) => boundaryInside(v, leaf),
    ),
  };
}

function boundaryInside(version: VersionRef, leaf: PlanLeaf): boolean {
  const start = leaf.start.getTime();
  const end = leaf.end.getTime();
  return [version.from.getTime(), version.to?.getTime() ?? null].some(
    (t) => t !== null && t > start && t < end,
  );
}

/**
 * Share of the shared capacity the joint recipe gives `productId` (T43): a `shared_capacity` profile's
 * `productMixConstraints.shares[productId]`, a decimal in (0, 1]. Anything else has no share.
 */
export function recipeShare(
  profile: ProductionProfile,
  productId: string,
): string | null {
  if (profile.capacityModel !== 'shared_capacity') return null;
  const shares = profile.productMixConstraints?.shares;
  if (typeof shares !== 'object' || shares === null) return null;
  const value: unknown = (shares as Record<string, unknown>)[productId];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
