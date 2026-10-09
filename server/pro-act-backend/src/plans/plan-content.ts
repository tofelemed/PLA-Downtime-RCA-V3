import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { envInt } from '../common/helpers/time-bounds';
import {
  Distribution,
  PlanBasis,
  SliceStream,
} from '../domain/plans/plan.types';
import { PlanProductSlice } from './entities/plan-product-slice.entity';
import {
  PlanVersion,
  StoredManualTarget,
} from './entities/plan-version.entity';
import { invalid } from './plan-errors';

/** One product slice as the API and the v1 bridge describe it. */
export interface SliceContent {
  productId: string;
  profileId?: string | null;
  campaignFrom?: string | null;
  campaignTo?: string | null;
  weight?: string | null;
  target?: string | null;
  stream?: SliceStream;
}

/** Editable content of a plan version (POST body; PATCH of a draft sends any subset). */
export interface PlanContent {
  unitId: string;
  validFrom: string;
  validTo: string;
  basis: PlanBasis;
  headerTarget?: string | null;
  distribution?: Distribution;
  slices: SliceContent[];
  manualTargets?: StoredManualTarget[] | null;
  changeReason?: string | null;
}

export interface PlanWindow {
  from: Date;
  to: Date;
}

const DAY_MS = 86_400_000;

/** Longest plan window generated in one go (env PLAN_MAX_DAYS, default 400 days). */
export function maxPlanDays(): number {
  return envInt('PLAN_MAX_DAYS', 400);
}

/** Whole-second UTC instant (durations are integer seconds). */
function floorSecond(value: string | Date): Date {
  const ms = new Date(value).getTime();
  return new Date(ms - (((ms % 1000) + 1000) % 1000));
}

/** `[validFrom, validTo)` floored to whole seconds; 422 when empty or longer than PLAN_MAX_DAYS. */
export function windowOf(content: {
  validFrom: string | Date;
  validTo: string | Date;
}): PlanWindow {
  const window = {
    from: floorSecond(content.validFrom),
    to: floorSecond(content.validTo),
  };
  if (!(window.to.getTime() > window.from.getTime())) {
    throw invalid('INVALID_PLAN_WINDOW', 'validTo must be after validFrom');
  }
  if (window.to.getTime() - window.from.getTime() > maxPlanDays() * DAY_MS) {
    throw invalid(
      'PLAN_TOO_LONG',
      `a plan version covers at most ${maxPlanDays()} days`,
    );
  }
  return window;
}

/** Stored slice rows of a version: campaign ∩ window is the slice's active range (PLAN04 constraint). */
export function sliceRows(
  version: Pick<PlanVersion, 'id' | 'tenantId' | 'scenarioId' | 'unitId'>,
  window: PlanWindow,
  slices: readonly SliceContent[],
  actorId: string | null,
): Array<QueryDeepPartialEntity<PlanProductSlice>> {
  return slices.map((slice, position) => {
    const campaignFrom = slice.campaignFrom
      ? new Date(slice.campaignFrom)
      : null;
    const campaignTo = slice.campaignTo ? new Date(slice.campaignTo) : null;
    const activeFrom = maxDate(window.from, campaignFrom);
    const activeTo = minDate(window.to, campaignTo);
    if (!(activeTo.getTime() > activeFrom.getTime())) {
      throw invalid(
        'INVALID_CAMPAIGN',
        `slices[${position}]: the campaign must overlap the plan window and end after it starts`,
      );
    }
    return {
      tenantId: version.tenantId,
      planVersionId: version.id,
      position,
      productId: slice.productId,
      profileId: slice.profileId ?? null,
      campaignFrom,
      campaignTo,
      weight: slice.weight ?? null,
      target: slice.target ?? null,
      stream: slice.stream ?? 'sequential',
      scenarioId: version.scenarioId,
      unitId: version.unitId,
      activeFrom,
      activeTo,
      isApproved: false,
      createdBy: actorId,
      updatedBy: actorId,
    };
  });
}

function maxDate(a: Date, b: Date | null): Date {
  return b && b.getTime() > a.getTime() ? b : a;
}

function minDate(a: Date, b: Date | null): Date {
  return b && b.getTime() < a.getTime() ? b : a;
}

/** The content of a stored version and its slices (base of a new draft, or of a PATCH merge). */
export function contentOf(
  version: PlanVersion,
  slices: readonly PlanProductSlice[],
): PlanContent {
  return {
    unitId: version.unitId,
    validFrom: version.validFrom.toISOString(),
    validTo: version.validTo.toISOString(),
    basis: version.basis,
    headerTarget: version.headerTarget,
    distribution: version.distribution,
    manualTargets: version.manualTargets,
    changeReason: version.changeReason,
    slices: [...slices]
      .sort((a, b) => a.position - b.position)
      .map((slice) => ({
        productId: slice.productId,
        profileId: slice.profileId,
        campaignFrom: slice.campaignFrom?.toISOString() ?? null,
        campaignTo: slice.campaignTo?.toISOString() ?? null,
        weight: slice.weight,
        target: slice.target,
        stream: slice.stream,
      })),
  };
}

/** Version columns of a content (window validated). */
export function versionColumns(content: PlanContent): Partial<PlanVersion> {
  const window = windowOf(content);
  return {
    unitId: content.unitId,
    validFrom: window.from,
    validTo: window.to,
    basis: content.basis,
    headerTarget: content.headerTarget ?? null,
    distribution: content.distribution ?? 'scheduled_capacity',
    targetSource: content.basis === 'time' ? 'generated' : 'entered',
    manualTargets:
      content.basis === 'manual' ? (content.manualTargets ?? []) : null,
    changeReason: content.changeReason?.trim() || null,
    periodsGeneratedAt: null,
    generationWarnings: null,
    generationError: null,
  };
}
