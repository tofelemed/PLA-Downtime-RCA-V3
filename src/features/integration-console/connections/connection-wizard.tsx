import { Suspense, useMemo, useState } from 'react';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { useCreateConnection, useUpdateConnection } from '@/api/v2/queries/integration-connections';
import type { ConnectionView, SourceType } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { ConsoleRefusal } from '../components/console-refusal';
import { useUrlParam } from '../hooks/use-url-param';
import { emptyPiForm, formFromConnection, piCreateBody, piFormErrors, piUpdateBody, type PiConnectionForm, type PiFormErrors } from '../model/connection-form';
import { LazyMqttWizardBody } from '../mqtt/mqtt-lazy';
import { PiConnectionFields } from './pi-connection-fields';
import { SourceTypePicker } from './source-type-picker';

export interface ConnectionWizardProps {
  /** null = create a new connection */
  connection: ConnectionView | null;
  onClose: () => void;
  onSaved: (connection: ConnectionView) => void;
}

const PICKABLE = ['none', 'pi_web_api', 'mqtt'] as const;
type Pickable = (typeof PICKABLE)[number];

/**
 * Create or change a connection (plan 3.7) on its own page: pick the source type (`?type=`), fill the
 * source's form (MQTT: four steps, `?step=`), save. The form, and with it the typed password, lives in
 * memory only and is discarded when the page is left.
 */
export function ConnectionWizard({ connection, onClose, onSaved }: ConnectionWizardProps) {
  const [picked, setPicked] = useUrlParam<Pickable>('type', PICKABLE, 'none');
  const type: SourceType | null = connection?.sourceType ?? (picked === 'none' ? null : picked);
  if (type === null) {
    return (
      <div className="space-y-4" data-testid="connection-wizard">
        <SourceTypePicker onPick={(next) => setPicked(next === 'mqtt' ? 'mqtt' : 'pi_web_api')} />
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4" data-testid="connection-wizard">
      {type === 'mqtt' ? (
        <Suspense fallback={<DataState state="loading" />}>
          <LazyMqttWizardBody connection={connection} onClose={onClose} onSaved={onSaved} />
        </Suspense>
      ) : (
        <PiWizardBody connection={connection} onClose={onClose} onSaved={onSaved} />
      )}
    </div>
  );
}

function PiWizardBody({ connection, onClose, onSaved }: ConnectionWizardProps) {
  const initial = useMemo(() => (connection ? formFromConnection(connection) : emptyPiForm()), [connection]);
  const [form, setForm] = useState<PiConnectionForm>(initial);
  const [errors, setErrors] = useState<PiFormErrors>({});
  const create = useCreateConnection();
  const update = useUpdateConnection();
  const failed = create.error ?? update.error;
  useUnsavedChangesGuard(hasUnsavedChanges(form, initial, [create.isPending, update.isPending]));

  const saveChange = async (current: ConnectionView) => {
    const body = piUpdateBody(form, current);
    if (!body) return current;
    return update.submit({ connection: current, body }).catch(() => null);
  };
  const save = async () => {
    const problems = piFormErrors(form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    const saved = connection ? await saveChange(connection) : await create.submit(piCreateBody(form)).catch(() => null);
    if (!saved) return;
    setForm(emptyPiForm());
    onSaved(saved);
  };

  return (
    <>
      <PiConnectionFields form={form} errors={errors} hasSecret={connection?.hasSecret ?? false} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />
      <ConsoleRefusal error={failed} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button data-testid="connection-save" onClick={() => void save()} disabled={create.isPending || update.isPending}>
          {connection ? 'Save changes' : 'Create connection'}
        </Button>
      </div>
    </>
  );
}
