import { useState } from 'react';
import { useCreateConnection, useUpdateConnection } from '@/api/v2/queries/integration-connections';
import { V2ApiError } from '@/api/v2/errors';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { emptyMqttForm, mqttCreateBody, mqttFormFromConnection, mqttUpdateBody, type MqttConnectionForm, type MqttFormErrors } from '../model/mqtt-form';
import { mqttFormErrors } from '../model/mqtt-validation';
import { errorsFromServer, errorsOfStep, firstStepWithErrors, WIZARD_STEPS, type WizardStep } from '../model/mqtt-steps';

export interface MqttWizard {
  step: WizardStep;
  form: MqttConnectionForm;
  /** every known error (client rules first, then the server's field errors) */
  errors: MqttFormErrors;
  /** the refused command, when the server said no (role, duplicate feed, secret required ...) */
  failed: unknown;
  isPending: boolean;
  goTo: (step: WizardStep) => void;
  next: () => void;
  back: () => void;
  change: (patch: Partial<MqttConnectionForm>) => void;
  save: () => Promise<void>;
}

const stepIndex = (step: WizardStep) => WIZARD_STEPS.findIndex((entry) => entry.key === step);

/**
 * Four-step MQTT wizard state (profile → basics → connection → advanced). `next` checks the current
 * step's rules; `save` checks everything, sends the create / change, and maps the server's 422 field
 * errors back onto the owning step. The form (and the typed password) lives only in memory.
 */
export function useMqttWizard(connection: ConnectionView | null, onSaved: (connection: ConnectionView) => void): MqttWizard {
  const [step, setStep] = useState<WizardStep>('profile');
  const [form, setForm] = useState<MqttConnectionForm>(() => (connection ? mqttFormFromConnection(connection) : emptyMqttForm()));
  const [errors, setErrors] = useState<MqttFormErrors>({});
  const create = useCreateConnection();
  const update = useUpdateConnection();

  const change = (patch: Partial<MqttConnectionForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !(field in patch))) as MqttFormErrors);
  };
  const next = () => {
    // the profile step is filled before the topic filters: the template / filter overlap is checked on save
    const stepErrors = errorsOfStep(mqttFormErrors(form, { checkTopicOverlap: step !== 'profile' }), step);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    const index = stepIndex(step);
    if (index < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[index + 1].key);
  };
  const back = () => {
    const index = stepIndex(step);
    if (index > 0) setStep(WIZARD_STEPS[index - 1].key);
  };
  const failWith = (problems: MqttFormErrors) => {
    setErrors(problems);
    const owner = firstStepWithErrors(problems);
    if (owner) setStep(owner);
  };
  const submit = async (): Promise<ConnectionView | null> => {
    if (!connection) return create.submit(mqttCreateBody(form));
    const body = mqttUpdateBody(form, connection);
    return body ? update.submit({ connection, body }) : connection;
  };
  const save = async () => {
    const problems = mqttFormErrors(form);
    if (Object.keys(problems).length > 0) return failWith(problems);
    try {
      const saved = await submit();
      if (!saved) return;
      setForm(emptyMqttForm());
      create.reset();
      update.reset();
      onSaved(saved);
    } catch (error) {
      if (error instanceof V2ApiError && error.fieldErrors.length > 0) failWith(errorsFromServer(error.fieldErrors));
    }
  };
  return { step, form, errors, failed: create.error ?? update.error, isPending: create.isPending || update.isPending, goTo: setStep, next, back, change, save };
}
