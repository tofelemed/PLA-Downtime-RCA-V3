import { useState } from 'react';
import { useSourceMappingPreview } from '@/api/v2/queries/integration-mappings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUnitNames } from '@/features/ux-kit/labels';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { ResolutionPreview } from './resolution-preview';

/**
 * "Where does this source go today?": resolves a typed path or id against the saved rules on the server
 * (exact id → path → pattern → AF binding), nothing is stored. Run it before and after saving a rule.
 */
export function MappingTest({ connectionId, initial }: { connectionId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const preview = useSourceMappingPreview();
  const { nameOf } = useUnitNames();
  const run = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const sample = { sourceId: trimmed, sourcePath: trimmed };
    void preview.submit({ ...(connectionId ? { connectionId } : {}), samples: [sample] }).catch(() => null);
  };
  return (
    <div className="space-y-3" data-testid="mapping-test">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-72 flex-1">
          <Field id="mapping-test-value" label="Source path or id to test">
            <Input id="mapping-test-value" value={value} onChange={(event) => setValue(event.target.value)} />
          </Field>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={!value.trim() || preview.isPending} data-testid="mapping-test-run">
          Test resolution
        </Button>
      </div>
      <ConsoleRefusal error={preview.error} />
      {preview.data && <ResolutionPreview preview={preview.data} nameOf={nameOf} />}
    </div>
  );
}
