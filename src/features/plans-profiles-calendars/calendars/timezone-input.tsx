import { useId, useMemo } from 'react';
import { Input } from '@/components/ui/input';

export interface TimezoneInputProps {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/** IANA zones the browser knows (suggestions only — the server validates the zone). */
function knownZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  return intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : [];
}

/** Free text with the time-zone names the browser knows as suggestions; the server validates it. */
export function TimezoneInput({ id, value, disabled, onChange }: TimezoneInputProps) {
  const listId = useId();
  const zones = useMemo(knownZones, []);
  return (
    <>
      <Input id={id} list={listId} value={value} disabled={disabled} placeholder="Region/City" onChange={(event) => onChange(event.target.value)} />
      <datalist id={listId}>
        {zones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
    </>
  );
}
