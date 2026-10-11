import { Suspense, useState } from 'react';
import { useCreateConnection, useUpdateConnection } from '@/api/v2/queries/integration-connections';
import type { ConnectionView, SourceType } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { ConsoleRefusal } from '../components/console-refusal';
import { emptyPiForm, formFromConnection, piCreateBody, piFormErrors, piUpdateBody, type PiConnectionForm, type PiFormErrors } from '../model/connection-form';
import { LazyMqttWizardBody } from '../mqtt/mqtt-lazy';
import { PiConnectionFields } from './pi-connection-fields';
import { SourceTypePicker } from './source-type-picker';

export interface ConnectionWizardProps {
  open: boolean;
  /** null = create a new connection */
  connection: ConnectionView | null;
  onClose: () => void;
  onSaved: (connection: ConnectionView) => void;
}

/**
 * Create or change a connection (plan 3.7): pick the source type (PI, or MQTT since plan 1.8), fill
 * the source's form, save. The form — and with it the typed password — is discarded on close.
 */
export function ConnectionWizard({ open, connection, onClose, onSaved }: ConnectionWizardProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="connection-wizard">
        {open && <WizardBody connection={connection} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function WizardBody({ connection, onClose, onSaved }: Omit<ConnectionWizardProps, 'open'>) {
  const [type, setType] = useState<SourceType | null>(connection?.sourceType ?? null);
  const header = (
    <DialogHeader>
      <DialogTitle>{connection ? `Edit ${connection.displayName}` : 'New connection'}</DialogTitle>
      <DialogDescription>Endpoint settings are stored with the connection; credentials are stored encrypted by reference and never shown again.</DialogDescription>
    </DialogHeader>
  );
  if (type === null) {
    return (
      <>
        {header}
        <SourceTypePicker onPick={setType} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </>
    );
  }
  if (type === 'mqtt') {
    return (
      <>
        {header}
        <Suspense fallback={<DataState state="loading" />}>
          <LazyMqttWizardBody connection={connection} onClose={onClose} onSaved={onSaved} />
        </Suspense>
      </>
    );
  }
  return (
    <>
      {header}
      <PiWizardBody connection={connection} onClose={onClose} onSaved={onSaved} />
    </>
  );
}

function PiWizardBody({ connection, onClose, onSaved }: Omit<ConnectionWizardProps, 'open'>) {
  const [form, setForm] = useState<PiConnectionForm>(() => (connection ? formFromConnection(connection) : emptyPiForm()));
  const [errors, setErrors] = useState<PiFormErrors>({});
  const create = useCreateConnection();
  const update = useUpdateConnection();
  const failed = create.error ?? update.error;

  const save = async () => {
    const problems = piFormErrors(form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    const saved = connection ? await saveChange(connection) : await create.submit(piCreateBody(form)).catch(() => null);
    if (!saved) return;
    setForm(emptyPiForm());
    create.reset();
    update.reset();
    onSaved(saved);
  };
  const saveChange = async (current: ConnectionView) => {
    const body = piUpdateBody(form, current);
    if (!body) return current;
    return update.submit({ connection: current, body }).catch(() => null);
  };

  return (
    <>
      <PiConnectionFields form={form} errors={errors} hasSecret={connection?.hasSecret ?? false} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />
      <ConsoleRefusal error={failed} />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button data-testid="connection-save" onClick={() => void save()} disabled={create.isPending || update.isPending}>
          {connection ? 'Save changes' : 'Create connection'}
        </Button>
      </DialogFooter>
    </>
  );
}
