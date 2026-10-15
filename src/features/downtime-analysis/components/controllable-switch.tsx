import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/** Switch that shows the controllable availability next to the headline figures. */
export function ControllableSwitch({ checked, onChange, testId = 'controllable-switch' }: { checked: boolean; onChange: (next: boolean) => void; testId?: string }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2 text-sm">
      <Switch id={id} checked={checked} onCheckedChange={onChange} data-testid={testId} />
      <Label htmlFor={id}>Show controllable view</Label>
    </div>
  );
}
