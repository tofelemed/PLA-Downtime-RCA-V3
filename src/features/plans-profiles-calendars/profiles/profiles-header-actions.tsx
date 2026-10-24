import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentAddress, withReturnTo } from '@/features/ux-kit/page-layout';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import type { ProfilesAreaTab } from '../model/profiles-area';
import { AddUnitStream } from '../streams/add-unit-stream';
import { AddTransitionStandard } from './add-transition-standard';

/** "Import rates" (approvers) and "New profile" (writers); the links carry this address (`?back=`). */
function ProfileActions() {
  const { canWriteProfiles, canApproveProfiles } = useCapabilities();
  const here = useCurrentAddress();
  return (
    <>
      {canApproveProfiles && (
        <Button asChild size="sm" variant="outline" className="whitespace-nowrap" data-testid="rate-import">
          <Link to={withReturnTo('/planning/profiles/import', here)}>
            <ActionIcon.import className="h-4 w-4" aria-hidden="true" />
            Import rates
          </Link>
        </Button>
      )}
      {canWriteProfiles && (
        <Button asChild size="sm" className="whitespace-nowrap" data-testid="profile-new">
          <Link to={withReturnTo('/planning/profiles/new', here)}>
            <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
            New profile
          </Link>
        </Button>
      )}
    </>
  );
}

const ADD: Record<ProfilesAreaTab, () => JSX.Element | null> = { profiles: ProfileActions, transitions: AddTransitionStandard, streams: AddUnitStream };

/** Right of the Profiles & rates title: the active tab's add / import actions, the Read-only note for viewers. */
export function ProfilesHeaderActions({ tab }: { tab: ProfilesAreaTab }) {
  const Add = ADD[tab];
  return (
    <>
      <ReadOnlyHint />
      <Add />
    </>
  );
}
