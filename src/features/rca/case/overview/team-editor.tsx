import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconButton } from '@/features/ux-kit/icon-button';
import { useUserNames } from '@/features/ux-kit/labels';
import { ActionIcon } from '@/lib/icons';
import { useAssignableUsers } from '../../use-assignable-users';

export interface TeamValue {
  teamLeadId: string | null;
  teamMemberIds: string[];
}

const NONE = 'none';

/** Team lead and members, picked from the plant's active users (names only, never ids). */
export function TeamEditor({ value, onChange, readOnly }: { value: TeamValue; onChange: (next: TeamValue) => void; readOnly: boolean }) {
  const { users } = useAssignableUsers();
  const names = useUserNames();
  const [candidate, setCandidate] = useState(NONE);
  const nameOf = (id: string) => users.find((user) => user.id === id)?.name ?? names.nameOf(id);
  const addable = users.filter((user) => !value.teamMemberIds.includes(user.id));
  const add = () => {
    if (candidate === NONE) return;
    onChange({ ...value, teamMemberIds: [...value.teamMemberIds, candidate] });
    setCandidate(NONE);
  };
  const remove = (id: string) =>
    onChange({ teamLeadId: value.teamLeadId === id ? null : value.teamLeadId, teamMemberIds: value.teamMemberIds.filter((member) => member !== id) });
  return (
    <div className="space-y-3" data-testid="team-editor">
      <div className="space-y-1">
        <Label htmlFor="team-lead">Team lead</Label>
        <Select value={value.teamLeadId ?? NONE} disabled={readOnly} onValueChange={(lead) => onChange({ ...value, teamLeadId: lead === NONE ? null : lead })}>
          <SelectTrigger id="team-lead" className="sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No team lead</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Team members">
        {value.teamMemberIds.length === 0 && <li className="text-sm text-muted-foreground">No team members yet.</li>}
        {value.teamMemberIds.map((id) => (
          <li key={id}>
            <Badge variant="secondary" className="gap-1">
              {nameOf(id)}
              {id === value.teamLeadId && <span className="text-xs">(lead)</span>}
              {!readOnly && <IconButton icon={ActionIcon.remove} label={`Remove ${nameOf(id)}`} className="h-5 w-5" onClick={() => remove(id)} />}
            </Badge>
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="team-add">Add a team member</Label>
            <Select value={candidate} onValueChange={setCandidate}>
              <SelectTrigger id="team-add" className="sm:w-72">
                <SelectValue placeholder="Choose a person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Choose a person</SelectItem>
                {addable.map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={candidate === NONE} onClick={add}>
            Add member
          </Button>
        </div>
      )}
    </div>
  );
}
