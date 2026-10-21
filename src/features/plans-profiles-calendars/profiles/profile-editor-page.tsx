import { useNavigate, useParams } from 'react-router-dom';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { useProfile } from '../hooks/use-profile-reads';
import { ProfileEditor } from './profile-editor';

const LIST = '/setup/profiles';

/** `/planning/profiles/new`: a new draft profile version. */
export function NewProfilePage() {
  const refs = usePlanningRefs();
  const navigate = useNavigate();
  return (
    <Page>
      <PageHeader title="New profile version" description="Saved as a draft; a manager approver approves it." back={{ to: LIST, label: 'Profiles & rates' }} />
      <ProfileEditor profile={null} refs={refs} cancelTo={LIST} onSaved={(saved) => navigate(`/planning/profiles/${saved.id}`)} />
    </Page>
  );
}

/** `/planning/profiles/:profileId/edit`: edit a draft profile version. */
export function EditProfilePage() {
  const { profileId = null } = useParams();
  const navigate = useNavigate();
  const refs = usePlanningRefs();
  const profile = useProfile(profileId);
  const back = profileId ? `/planning/profiles/${profileId}` : LIST;
  const state = dataStateOf(profile);
  const shown = profile.data;
  return (
    <Page>
      <PageHeader title={shown ? `Edit draft profile version ${shown.version}` : 'Edit draft profile'} back={{ to: back, label: 'Profile' }} />
      {state === 'ready' && shown ? (
        <ProfileEditor key={`${shown.id}-${shown.rowVersion}`} profile={shown} refs={refs} cancelTo={back} onSaved={(saved) => navigate(`/planning/profiles/${saved.id}`)} />
      ) : (
        <DataState state={state} error={profile.error} />
      )}
    </Page>
  );
}
