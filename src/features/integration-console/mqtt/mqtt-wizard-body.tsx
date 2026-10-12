import type { ConnectionView } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { ConsoleRefusal } from '../components/console-refusal';
import { useUrlParam } from '../hooks/use-url-param';
import { useMqttWizard } from './hooks/use-mqtt-wizard';
import { errorsOfStep, WIZARD_STEPS, type WizardStep } from './model/mqtt-steps';
import { AdvancedStep } from './steps/advanced-step';
import { BasicsStep } from './steps/basics-step';
import { ConnectionStep } from './steps/connection-step';
import { ProfileStep } from './steps/profile-step';

const STEP_KEYS: readonly WizardStep[] = WIZARD_STEPS.map((step) => step.key);

export interface MqttWizardBodyProps {
  /** null = create */
  connection: ConnectionView | null;
  onClose: () => void;
  onSaved: (connection: ConnectionView) => void;
}

/**
 * MQTT connection wizard (plan 1.8 step 5, 3.7 wizard): profile → basics → connection → advanced,
 * producing exactly the adapter's `endpoint_config` (`mqtt` + `payloadProfile`). Client-side rules
 * mirror the server's for instant feedback; a 422 lands on the step that owns the field.
 */
export function MqttWizardBody({ connection, onClose, onSaved }: MqttWizardBodyProps) {
  const stepState = useUrlParam<WizardStep>('step', STEP_KEYS, 'profile');
  const wizard = useMqttWizard(connection, onSaved, stepState);
  const last = wizard.step === WIZARD_STEPS[WIZARD_STEPS.length - 1].key;
  const stepProps = { form: wizard.form, errors: wizard.errors, onChange: wizard.change };
  const stepHasErrors = (step: WizardStep) => Object.keys(errorsOfStep(wizard.errors, step)).length > 0;
  return (
    <div className="space-y-4" data-testid="mqtt-wizard" data-step={wizard.step}>
      <ol className="flex flex-wrap gap-1" aria-label="Wizard steps">
        {WIZARD_STEPS.map((step, index) => (
          <li key={step.key}>
            <button
              type="button"
              aria-current={wizard.step === step.key ? 'step' : undefined}
              data-testid={`mqtt-step-${step.key}`}
              data-has-errors={stepHasErrors(step.key)}
              onClick={() => wizard.goTo(step.key)}
              className={`rounded-md border px-2 py-1 text-xs ${wizard.step === step.key ? 'border-primary bg-muted font-medium' : 'text-muted-foreground'} ${stepHasErrors(step.key) ? 'border-destructive' : ''}`}
            >
              {index + 1}. {step.label}
              {stepHasErrors(step.key) ? ' !' : ''}
            </button>
          </li>
        ))}
      </ol>
      {wizard.step === 'profile' && <ProfileStep {...stepProps} />}
      {wizard.step === 'basics' && <BasicsStep {...stepProps} />}
      {wizard.step === 'connection' && <ConnectionStep {...stepProps} hasSecret={connection?.hasSecret ?? false} />}
      {wizard.step === 'advanced' && <AdvancedStep {...stepProps} />}
      <ConsoleRefusal error={wizard.failed} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="outline" onClick={wizard.back} disabled={wizard.step === 'profile'} data-testid="mqtt-back">
          Back
        </Button>
        {!last && (
          <Button variant="secondary" onClick={wizard.next} data-testid="mqtt-next">
            Next
          </Button>
        )}
        <Button onClick={() => void wizard.save()} disabled={wizard.isPending} data-testid="connection-save">
          {connection ? 'Save changes' : 'Create connection'}
        </Button>
      </div>
    </div>
  );
}
