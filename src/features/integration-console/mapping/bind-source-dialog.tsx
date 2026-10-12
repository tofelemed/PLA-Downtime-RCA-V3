import { useState } from 'react';
import { useConnection } from '@/api/v2/queries/integration-connections';
import { useCreateSourceMapping, useSourceMappingPreview } from '@/api/v2/queries/integration-mappings';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useUnits } from '@/api/v2/queries/units';
import type { MappingSample, SourceMappingView } from '@/api/v2/types/integration-mappings';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUnitNames } from '@/features/ux-kit/labels';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import { sourceSystemOf } from '../model/mapping-form';
import type { BindTarget } from '../model/exception-flow';
import { ResolutionPreview } from './resolution-preview';

export interface BindSourceDialogProps {
  connectionId: string;
  /** null = closed */
  target: BindTarget | null;
  onClose: () => void;
  onBound: (mapping: SourceMappingView) => void;
}

const sampleOf = (target: BindTarget): MappingSample =>
  target.matchKind === 'exact_path' ? { sourcePath: target.matchValue } : { sourceId: target.matchValue, afElementWebIds: [target.matchValue] };

/**
 * Binds a discovered source identifier (picked, never typed by hand) to a unit (ING03): preview how the
 * current rules resolve it — precedence, ambiguity, invalid targets — then create the rule.
 */
export function BindSourceDialog({ connectionId, target, onClose, onBound }: BindSourceDialogProps) {
  const units = useUnits();
  const connection = useConnection(connectionId);
  const [unitId, setUnitId] = useState('');
  const preview = useSourceMappingPreview();
  const create = useCreateSourceMapping();
  const unitList = flattenPages(units.data?.pages);
  const options = unitList.map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.code})` }));
  const { nameOf } = useUnitNames();
  const close = () => {
    preview.reset();
    create.reset();
    setUnitId('');
    onClose();
  };
  const bind = async () => {
    if (!target || !unitId) return;
    const body = { matchKind: target.matchKind, matchValue: target.matchValue, targetType: 'unit' as const, targetId: unitId, precedence: 0, connectionId, sourceSystem: sourceSystemOf(connection.data?.sourceType), isActive: true };
    const mapping = await create.submit(body).catch(() => null);
    if (!mapping) return;
    close();
    onBound(mapping);
  };
  return (
    <Dialog open={target !== null} onOpenChange={(next) => !next && close()}>
      <DialogContent data-testid="bind-source-dialog">
        <DialogHeader>
          <DialogTitle>Bind source to a unit</DialogTitle>
          <DialogDescription>
            {target ? `${target.matchKind === 'exact_path' ? 'Path' : 'Element id'}: ${target.matchValue}` : ''}
          </DialogDescription>
        </DialogHeader>
        <Field id="bind-unit" label="Unit">
          <NativeSelect id="bind-unit" testId="bind-unit" value={unitId} placeholder="Choose a unit" options={options} onChange={setUnitId} />
        </Field>
        <Button
          variant="outline"
          size="sm"
          disabled={!target}
          data-testid="bind-preview"
          onClick={() => target && void preview.submit({ connectionId, samples: [sampleOf(target)] }).catch(() => null)}
        >
          Preview current resolution
        </Button>
        {preview.data && <ResolutionPreview preview={preview.data} nameOf={nameOf} />}
        <ConsoleRefusal error={preview.error ?? create.error} />
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={!unitId || create.isPending} onClick={() => void bind()} data-testid="bind-confirm">
            Bind
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
