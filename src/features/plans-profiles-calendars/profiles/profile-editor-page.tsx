import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ProfilesAreaTabs } from '../components/profiles-area-tabs';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { useProfile } from '../hooks/use-profile-reads';
import { useProfilesBack } from '../hooks/use-profiles-back';
import { ProfileEditor } from './profile-editor';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';

const NEW_INFO =
  'Saved as a draft; a manager approver approves it. The quantity unit (e.g. t) is the unit of every rate of this profile; shared or independent streams matter only when products run at the same time.';

/** `/planning/profiles/new`: a new draft profile version; Back and Cancel return to the list as it was left. */
export function NewProfilePage() {
  const refs = usePlanningRefs();
  const navigate = useNavigate();
  const { search } = useLocation();
  const back = useProfilesBack();
  return (
    <Page>
      <PageHeader title="New profile version" titleAside={<KpiInfo label="New profile version" text={NEW_INFO} />} back={back} />
      <ProfilesAreaTabs current="profiles" unitId={back.unitId} />
      <ProfileEditor profile={null} refs={refs} cancelTo={back.to} onSaved={(saved) => navigate(`/planning/profiles/${saved.id}${search}`)} />
    </Page>
  );
}

/** `/planning/profiles/:profileId/edit`: edit a draft profile version (the list address stays in `?back=`). */
export function EditProfilePage() {
  const { profileId = null } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const refs = usePlanningRefs();
  const profile = useProfile(profileId);
  const list = useProfilesBack();
  const back = profileId ? `/planning/profiles/${profileId}${search}` : list.to;
  const state = dataStateOf(profile);
  const shown = profile.data;
  return (
    <Page>
      <PageHeader title={shown ? `Edit draft profile version ${shown.version}` : 'Edit draft profile'} back={{ to: back, label: 'Profile' }} />
      <ProfilesAreaTabs current="profiles" unitId={list.unitId} />
      {state === 'ready' && shown ? (
        <ProfileEditor key={`${shown.id}-${shown.rowVersion}`} profile={shown} refs={refs} cancelTo={back} onSaved={(saved) => navigate(`/planning/profiles/${saved.id}${search}`)} />
      ) : (
        <DataState state={state} error={profile.error} />
      )}
    </Page>
  );
}
