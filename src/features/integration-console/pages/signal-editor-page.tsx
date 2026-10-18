import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnection } from '@/api/v2/queries/integration-connections';
import { useCreateSignal } from '@/api/v2/queries/signals';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { ConsoleRefusal } from '../components/console-refusal';
import { emptySignalForm, signalBody, signalFormErrors, type SignalForm, type SignalFormErrors } from '../model/signal-form';
import { connectionPath } from '../paths';
import { SignalFormFields } from '../signals/signal-form-fields';

/**
 * `/connectivity/connections/:connectionId/signals/new`: defines a typed measurement signal (the v2 home
 * of the former historian tag configuration). A source key that already has a signal gets its next version.
 */
export function SignalEditorPage() {
  const { connectionId = '' } = useParams();
  const navigate = useNavigate();
  const { timezone } = usePlantTimezone();
  const { canWriteIntegration } = useCapabilities();
  const connection = useConnection(connectionId);
  const create = useCreateSignal();
  const [form, setForm] = useState<SignalForm>(emptySignalForm);
  const [errors, setErrors] = useState<SignalFormErrors>({});
  const back = connectionPath(connectionId, 'signals');
  const save = async () => {
    const problems = signalFormErrors(form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    const saved = await create.submit(signalBody(form, connectionId)).catch(() => null);
    if (saved) navigate(back);
  };
  return (
    <Page>
      <PageHeader
        title="Define signal"
        description={`A measurement delivered by ${connection.data?.displayName ?? 'this connection'}, used for trends and output accounting.`}
        back={{ to: back, label: 'Signals' }}
      />
      {!canWriteIntegration ? (
        <DataState state="no-permission" detail="Defining signals needs an integration administrator or manager approver." />
      ) : (
        <div className="space-y-6" data-testid="signal-editor">
          <SignalFormFields sourceKeyHint={connection.data?.sourceType === 'mqtt' ? (connection.data.endpointConfig?.payloadProfile as { kind?: string } | undefined)?.kind === 'state_json' ? 'For machine-state messages, enter the full MQTT topic. Map the delivered state tokens under Unit State.' : 'Enter the signal field from the MQTT measurement payload, not its topic. Example: EXT1_TOTALIZER.' : undefined} form={form} errors={errors} timezone={timezone} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />
          <ConsoleRefusal error={create.error} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()} disabled={create.isPending} data-testid="signal-save">
              Save signal
            </Button>
            <Button variant="outline" onClick={() => navigate(back)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Page>
  );
}
