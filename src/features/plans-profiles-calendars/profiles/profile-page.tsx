import { useNavigate, useParams } from 'react-router-dom';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { useProfile } from '../hooks/use-profile-reads';
import { ProfileDetail } from './profile-detail';

const BACK = { to: '/planning?tab=profiles', label: 'Profiles & rates' };

/** `/planning/profiles/:profileId`: one profile version with its rates, valuation rates and approvals. */
export function ProfilePage() {
  const { profileId = null } = useParams();
  const navigate = useNavigate();
  const profile = useProfile(profileId);
  const refs = usePlanningRefs();
  const state = dataStateOf(profile);
  if (state !== 'ready' || !profile.data) {
    return (
      <Page>
        <PageHeader title="Profile" back={BACK} />
        <DataState state={state} error={profile.error} />
      </Page>
    );
  }
  const p = profile.data;
  return (
    <Page>
      <PageHeader title={`${refs.unitName(p.unitId)} × ${refs.productName(p.productId)}`} description={`Operating mode ${p.operatingMode} · version ${p.version}`} back={BACK} />
      <ProfileDetail profile={p} refs={refs} onEdit={() => navigate(`/planning/profiles/${p.id}/edit`)} />
    </Page>
  );
}
