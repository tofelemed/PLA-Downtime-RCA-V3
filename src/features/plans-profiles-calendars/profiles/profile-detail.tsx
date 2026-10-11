import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProfileView } from '@/api/v2/types/profiles';
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

/** v1 capacity / cycle time kept on a seeded draft (no timebase): review values, never a rate (MIG §18.2). */
function LegacyValues({ profile }: { profile: ProfileView }) {
  const legacy = profile.legacy;
  if (!legacy || (legacy.capacity === null && legacy.idealCycleTime === null)) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="legacy-values">
      Legacy v1 values (review only, not used): capacity {legacy.capacity ?? '—'} {legacy.capacityUom ?? ''} · ideal cycle time{' '}
      {legacy.idealCycleTime ?? '—'} s. Enter and approve a sustained rate instead.
    </p>
  );
}

/** One profile version: key, quantity unit and timebase, validity, approval, rates and valuation rates. */
export function ProfileDetail({ profile, refs, onEdit }: ProfileDetailProps) {
  const tz = refs.timezone;
  return (
    <Card data-testid="profile-detail" data-profile-id={profile.id}>
      <CardHeader className="space-y-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {refs.unitName(profile.unitId)} × {refs.productName(profile.productId)} · {profile.operatingMode} · v{profile.version}
          <VersionStateBadge state={profile.state} />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Unit {profile.quantityUom ?? '—'} per {profile.rateTimebase ?? '—'} · {profile.capacityModel} · effective <PlantTime iso={profile.effectiveFrom} tz={tz} withDate /> →{' '}
          {profile.effectiveTo ? <PlantTime iso={profile.effectiveTo} tz={tz} withDate /> : 'open-ended'}
          {profile.approvedAt && (
            <>
              {' '}
              · approved <PlantTime iso={profile.approvedAt} tz={tz} withDate />
            </>
          )}
        </p>
        <LegacyValues profile={profile} />
        <VersionActions resource="profiles" id={profile.id} state={profile.state} timezone={tz} onEdit={onEdit} testId="profile-actions" authorId={profile.createdBy} />
      </CardHeader>
      <CardContent className="space-y-6">
        <RateTable profile={profile} timezone={tz} />
        <ValuationRateTable profile={profile} timezone={tz} />
      </CardContent>
    </Card>
  );
}
