import { useUserNames } from '@/features/ux-kit/labels';
import { TEAM_LOCKED_STATUSES } from '../../model/case-workflow';
import { useCaseWorkspace } from '../case-context';
import { CaseCard } from '../components/case-card';
import { CaseFact, CaseFacts } from '../components/case-facts';

/** What the Team ⓘ says once the investigation was accepted. */
export const TEAM_LOCKED_INFO = 'The accepted investigation team is fixed until the investigation is reopened, so the closure approver is judged against a known team.';

/** Team lead and members of the case (names only), in the overview's side column. */
export function TeamSummary() {
  const { rca } = useCaseWorkspace();
  const users = useUserNames();
  const locked = TEAM_LOCKED_STATUSES.includes(rca.status ?? '');
  return (
    <CaseCard title="Team" info={locked ? TEAM_LOCKED_INFO : 'Team lead and members of the investigation.'}>
      <CaseFacts layout="stacked" testId="team-summary">
        <CaseFact label="Team lead">{rca.teamLeadId ? users.nameOf(rca.teamLeadId) : 'No team lead'}</CaseFact>
        <CaseFact label="Team members">{rca.teamMemberIds.length ? rca.teamMemberIds.map(users.nameOf).join(', ') : 'No team members yet.'}</CaseFact>
      </CaseFacts>
    </CaseCard>
  );
}
