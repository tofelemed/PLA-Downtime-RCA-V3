import type { ProfileView } from '@/api/v2/types/profiles';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { VersionStateBadge } from '../components/version-state-badge';
import type { PlanningRefs } from '../hooks/use-planning-refs';

export interface ProfileListProps {
  profiles: readonly ProfileView[];
  selectedId: string | null;
  refs: PlanningRefs;
  onSelect: (id: string) => void;
}

/** Profile versions (unit × product × mode, state, validity); keyboard-selectable rows. */
export function ProfileList({ profiles, selectedId, refs, onSelect }: ProfileListProps) {
  return (
    <ul className="max-h-[32rem] space-y-1 overflow-auto" data-testid="profile-list">
      {profiles.map((profile) => (
        <li key={profile.id}>
          <button
            type="button"
            className={`w-full rounded-md border p-2 text-left text-sm hover:bg-muted ${profile.id === selectedId ? 'border-primary bg-muted' : ''}`}
            aria-pressed={profile.id === selectedId}
            data-testid="profile-row"
            data-profile-id={profile.id}
            onClick={() => onSelect(profile.id)}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {refs.unitName(profile.unitId)} × {refs.productName(profile.productId)}
              </span>
              <VersionStateBadge state={profile.state} />
            </span>
            <span className="block text-xs text-muted-foreground">
              {profile.operatingMode} · v{profile.version} · from <PlantTime iso={profile.effectiveFrom} tz={refs.timezone} withDate />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
