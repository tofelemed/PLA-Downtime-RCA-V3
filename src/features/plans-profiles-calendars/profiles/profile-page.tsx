import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ProfilesAreaTabs } from '../components/profiles-area-tabs';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { useProfile } from '../hooks/use-profile-reads';
import { useProfilesBack } from '../hooks/use-profiles-back';
import { ProfileDetail } from './profile-detail';
import { operatingModeLabel } from '../model/plan-labels';

/**
 * `/planning/profiles/:profileId`: one profile version with its rates, valuation rates and approvals. Back
 * returns to the list as it was left (`?back=`, kept on the edit page too).
 */
export function ProfilePage() {
  const { profileId = null } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const profile = useProfile(profileId);
  const refs = usePlanningRefs();
  const back = useProfilesBack();
  const state = dataStateOf(profile);
  const tabs = <ProfilesAreaTabs current="profiles" unitId={back.unitId} />;
  if (state !== 'ready' || !profile.data) {
    return (
      <Page>
        <PageHeader title="Profile" back={back} />
        {tabs}
        <DataState state={state} error={profile.error} />
      </Page>
    );
  }
  const p = profile.data;
  return (
    <Page>
      <PageHeader title={`${refs.unitName(p.unitId)} × ${refs.productName(p.productId)}`} description={`Operating mode: ${operatingModeLabel(p.operatingMode)} · version ${p.version}`} back={back} />
      {tabs}
      <ProfileDetail profile={p} refs={refs} onEdit={() => navigate(`/planning/profiles/${p.id}/edit${search}`)} />
    </Page>
  );
}
