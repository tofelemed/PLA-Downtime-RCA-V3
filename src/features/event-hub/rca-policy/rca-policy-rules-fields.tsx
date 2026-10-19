import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/ux-kit/form-field';
import { ANALYSIS_METHOD_KEYS, ANALYSIS_METHOD_LABELS, CONSEQUENCE_CLASSES, percentError, type ConsequenceClass, type RcaRulesDraft } from './rca-policy-rules-draft';

type SetRule = <K extends keyof RcaRulesDraft>(key: K, value: RcaRulesDraft[K]) => void;

interface Props {
  draft: RcaRulesDraft;
  set: SetRule;
}

function NumberInput({ id, label, hint, value, onChange, error }: { id: string; label: string; hint: string; value: string; onChange: (value: string) => void; error?: string | null }) {
  return (
    <FormField id={id} label={label} hint={hint} error={error ?? undefined}>
      <Input id={id} inputMode="numeric" value={value} aria-invalid={error ? true : undefined} onChange={(e) => onChange(e.target.value)} />
    </FormField>
  );
}

function Check({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

/** CA2 / CA3: how an action's effectiveness is judged (frozen into each action when its verification is planned). */
function EffectivenessFields({ draft, set }: Props) {
  const toggle = (cls: ConsequenceClass, on: boolean) =>
    set('zeroRepeatClasses', on ? [...draft.zeroRepeatClasses, cls] : draft.zeroRepeatClasses.filter((value) => value !== cls));
  return (
    <fieldset className="grid gap-4 rounded border p-3 sm:grid-cols-2" data-testid="rca-policy-effectiveness">
      <legend className="px-1 text-sm font-medium">Effectiveness</legend>
      <NumberInput id="rca-min-exposure" label="Minimum run hours after the action" hint="Fewer known run hours in the verification window = not enough evidence." value={draft.minExposureHours} onChange={(v) => set('minExposureHours', v)} />
      <NumberInput id="rca-baseline-days" label="Baseline lookback (days)" hint="History before the verification window the baseline is counted from." value={draft.baselineLookbackDays} onChange={(v) => set('baselineLookbackDays', v)} />
      <NumberInput id="rca-reduction" label="Required reduction (%)" hint="The same-mode rate must fall by at least this much." value={draft.requiredReductionPercent} error={percentError(draft.requiredReductionPercent, false)} onChange={(v) => set('requiredReductionPercent', v)} />
      <NumberInput id="rca-min-coverage" label="Minimum state-data coverage for a verdict (%)" hint="Below this share of known unit state in the window after the action, the verdict is insufficient evidence." value={draft.minimumCoveragePercent} error={percentError(draft.minimumCoveragePercent, true)} onChange={(v) => set('minimumCoveragePercent', v)} />
            <NumberInput id="rca-review-days" label="Review checkpoint (days)" hint="Proposed review after the action." value={draft.reviewDays} onChange={(v) => set('reviewDays', v)} />
      <div className="space-y-2 sm:col-span-2">
        <p className="text-sm font-medium">Any repeat is not effective for</p>
        {CONSEQUENCE_CLASSES.map((cls) => (
          <Check key={cls} id={`rca-zero-${cls}`} label={`${cls} consequence`} checked={draft.zeroRepeatClasses.includes(cls)} onChange={(on) => toggle(cls, on)} />
        ))}
      </div>
    </fieldset>
  );
}

/** CA5 FMEA and CA6 5-Why rules. */
function AnalysisRuleFields({ draft, set }: Props) {
  return (
    <fieldset className="grid gap-4 rounded border p-3 sm:grid-cols-2" data-testid="rca-policy-analysis-rules">
      <legend className="px-1 text-sm font-medium">FMEA and 5-Why</legend>
      <FormField id="rca-fmea-method" label="FMEA method" hint="RPN, or action priority from the priority table of this policy.">
        <select id="rca-fmea-method" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={draft.fmeaMethod} onChange={(e) => set('fmeaMethod', e.target.value === 'action_priority' ? 'action_priority' : 'rpn')}>
          <option value="rpn">RPN</option>
          <option value="action_priority">Action priority</option>
        </select>
      </FormField>
      <NumberInput id="rca-rpn" label="RPN needing action" hint="An RPN at or above this needs an action." value={draft.rpnThreshold} onChange={(v) => set('rpnThreshold', v)} />
      <NumberInput id="rca-severity-review" label="Severity needing review (1–10)" hint="Reviewed whatever the RPN." value={draft.severityReview} onChange={(v) => set('severityReview', v)} />
      <NumberInput id="rca-why-guideline" label="5-Why guideline levels" hint="Guidance, not a rule." value={draft.guidelineLevels} onChange={(v) => set('guidelineLevels', v)} />
      <NumberInput id="rca-why-min" label="5-Why minimum levels" hint="Fewer levels block acceptance." value={draft.minLevels} onChange={(v) => set('minLevels', v)} />
      <Check id="rca-why-evidence" label="Evidence on every 5-Why level" checked={draft.evidencePerLevel} onChange={(on) => set('evidencePerLevel', on)} />
      <FormField id="rca-why-refused" label="Root causes refused on their own" hint="One phrase per line, e.g. operator error." className="sm:col-span-2">
        <Textarea id="rca-why-refused" value={draft.unsupportedRootCauses} onChange={(e) => set('unsupportedRootCauses', e.target.value)} />
      </FormField>
    </fieldset>
  );
}

/** CA7 methods and team size per consequence class. */
function InvestigationFields({ draft, set }: Props) {
  return (
    <fieldset className="grid gap-4 rounded border p-3 sm:grid-cols-3" data-testid="rca-policy-methods">
      <legend className="px-1 text-sm font-medium">Methods per consequence class</legend>
      <p className="text-xs text-muted-foreground sm:col-span-3">
        One group per line, methods separated by commas; each group needs at least one of its methods. Type each method as its key:{' '}
        {ANALYSIS_METHOD_KEYS.map((key) => `${ANALYSIS_METHOD_LABELS[key]} = ${key}`).join(', ')}.
      </p>
      {CONSEQUENCE_CLASSES.map((cls) => (
        <div key={cls} className="space-y-2">
          <FormField id={`rca-methods-${cls}`} label={`${cls[0].toUpperCase()}${cls.slice(1)}: method groups`}>
            <Textarea id={`rca-methods-${cls}`} value={draft.methodGroups[cls]} onChange={(e) => set('methodGroups', { ...draft.methodGroups, [cls]: e.target.value })} />
          </FormField>
          <NumberInput id={`rca-team-${cls}`} label="Minimum team members" hint="Accepting the investigation needs at least this many members." value={draft.minTeamMembers[cls]} onChange={(v) => set('minTeamMembers', { ...draft.minTeamMembers, [cls]: v })} />
        </div>
      ))}
    </fieldset>
  );
}

/** The workflow rules of the RCA policy (SME CA2–CA7), edited with the triggers; the server validates them. */
export function RcaPolicyRulesFields(props: Props) {
  return (
    <div className="space-y-4">
      <EffectivenessFields {...props} />
      <AnalysisRuleFields {...props} />
      <InvestigationFields {...props} />
    </div>
  );
}
