import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconButton } from '@/features/ux-kit/icon-button';
import { useUserNames } from '@/features/ux-kit/labels';
import { ActionIcon } from '@/lib/icons';
import { useAssignableUsers } from '../../use-assignable-users';
import { CaseFact, CaseFacts } from '../components/case-facts';

export interface TeamValue {
  teamLeadId: string | null;
  teamMemberIds: string[];
}

const NONE = 'none';

interface PersonOption {
  id: string;
  name: string;
}

/** The team as text (closed, a reader, or a team fixed since the investigation was accepted). */
function TeamText({ value, nameOf }: { value: TeamValue; nameOf: (id: string) => string }) {
  return (
    <div data-testid="team-editor" data-mode="read">
      <CaseFacts>
        <CaseFact label="Team lead">{value.teamLeadId ? nameOf(value.teamLeadId) : 'No team lead'}</CaseFact>
        <CaseFact label="Team members">{value.teamMemberIds.length ? value.teamMemberIds.map(nameOf).join(', ') : 'No team members yet.'}</CaseFact>
      </CaseFacts>
    </div>
  );
}

function PersonSelect({ id, value, options, noneLabel, onChange }: { id: string; value: string; options: readonly PersonOption[]; noneLabel: string; onChange: (id: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-9 sm:w-72">
        <SelectValue placeholder={noneLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {options.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddMember({ addable, onAdd }: { addable: readonly PersonOption[]; onAdd: (id: string) => void }) {
  const [candidate, setCandidate] = useState(NONE);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1.5">
        <Label htmlFor="team-add">Add a team member</Label>
        <PersonSelect id="team-add" value={candidate} options={addable} noneLabel="Choose a person" onChange={setCandidate} />
      </div>
      <Button type="button" variant="outline" className="h-9" disabled={candidate === NONE} onClick={() => { onAdd(candidate); setCandidate(NONE); }}>
        Add member
      </Button>
    </div>
  );
}

export interface TeamEditorProps {
  value: TeamValue;
  onChange: (next: TeamValue) => void;
  /** names as text, no controls */
  readOnly: boolean;
  /** controls kept but disabled (a save is running) */
  disabled?: boolean;
}

/** Team lead and members, picked from the plant's active users (names only, never ids). */
export function TeamEditor({ value, onChange, readOnly, disabled = false }: TeamEditorProps) {
  const { users } = useAssignableUsers();
  const names = useUserNames();
  const nameOf = (id: string) => users.find((user) => user.id === id)?.name ?? names.nameOf(id);
  if (readOnly) return <TeamText value={value} nameOf={nameOf} />;
  const remove = (id: string) =>
    onChange({ teamLeadId: value.teamLeadId === id ? null : value.teamLeadId, teamMemberIds: value.teamMemberIds.filter((member) => member !== id) });
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3" data-testid="team-editor" data-mode="edit">
      <div className="space-y-1.5">
        <Label htmlFor="team-lead">Team lead</Label>
        <PersonSelect id="team-lead" value={value.teamLeadId ?? NONE} options={users} noneLabel="No team lead" onChange={(lead) => onChange({ ...value, teamLeadId: lead === NONE ? null : lead })} />
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Team members">
        {value.teamMemberIds.length === 0 && <li className="text-sm text-muted-foreground">No team members yet.</li>}
        {value.teamMemberIds.map((id) => (
          <li key={id}>
            <Badge variant="secondary" className="gap-1">
              {nameOf(id)}
              {id === value.teamLeadId && <span className="text-xs">(lead)</span>}
              <IconButton icon={ActionIcon.remove} label={`Remove ${nameOf(id)}`} className="h-5 w-5" onClick={() => remove(id)} />
            </Badge>
          </li>
        ))}
      </ul>
      <AddMember addable={users.filter((user) => !value.teamMemberIds.includes(user.id))} onAdd={(id) => onChange({ ...value, teamMemberIds: [...value.teamMemberIds, id] })} />
    </fieldset>
  );
}
