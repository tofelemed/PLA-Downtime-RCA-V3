import type { ProfileView } from '@/api/v2/types/profiles';
import { CAPACITY_MODEL_LABELS, labelOf, RATE_TIMEBASE_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { VersionStateBadge } from '../components/version-state-badge';
import type { PlanningRefs } from '../hooks/use-planning-refs';
import { RateTable } from './rate-table';
import { ValuationRateTable } from './valuation-rate-table';
import { VersionActions } from './version-actions';

export interface ProfileDetailProps {
  profile: ProfileView;
  refs: PlanningRefs;
  onEdit: () => void;
}

/** Capacity / cycle time from the old master data kept on a seeded draft: review values, never a rate. */
function LegacyValues({ profile }: { profile: ProfileView }) {
  const legacy = profile.legacy;
  if (!legacy || (legacy.capacity === null && legacy.idealCycleTime === null)) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="legacy-values">
      Earlier master-data values (for review only, not used): capacity {legacy.capacity ?? '—'} {legacy.capacityUom ?? ''} · ideal cycle time{' '}
      {legacy.idealCycleTime ?? '—'} s. Enter and approve a sustained rate instead.
    </p>
  );
}

function Facts({ profile, tz }: { profile: ProfileView; tz: string }) {
  const perUnit = profile.rateTimebase ? labelOf(RATE_TIMEBASE_LABELS, profile.rateTimebase) : 'timebase not set';
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <VersionStateBadge state={profile.state} />
      <span>
        Rates in {profile.quantityUom ?? '—'} {perUnit} · {labelOf(CAPACITY_MODEL_LABELS, profile.capacityModel)} · effective <PlantTime iso={profile.effectiveFrom} tz={tz} withDate /> →{' '}
        {profile.effectiveTo ? <PlantTime iso={profile.effectiveTo} tz={tz} withDate /> : 'open-ended'}
        {profile.approvedAt && (
          <>
            {' '}
            · approved <PlantTime iso={profile.approvedAt} tz={tz} withDate />
          </>
        )}
      </span>
    </p>
  );
}

/** One profile version: key, quantity unit and timebase, validity, approval, rates and valuation rates. */
export function ProfileDetail({ profile, refs, onEdit }: ProfileDetailProps) {
  const tz = refs.timezone;
  return (
    <div className="space-y-6" data-testid="profile-detail" data-profile-id={profile.id}>
      <Section title="Profile version">
        <div className="space-y-3">
          <Facts profile={profile} tz={tz} />
          <LegacyValues profile={profile} />
          <VersionActions resource="profiles" id={profile.id} state={profile.state} timezone={tz} onEdit={onEdit} testId="profile-actions" authorId={profile.createdBy} />
        </div>
      </Section>
      <RateTable profile={profile} timezone={tz} />
      <ValuationRateTable profile={profile} timezone={tz} />
    </div>
  );
}
