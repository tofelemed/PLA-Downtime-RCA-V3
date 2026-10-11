import type { MqttConnectionForm, MqttFormErrors } from '../model/mqtt-form';

export interface StepProps {
  form: MqttConnectionForm;
  errors: MqttFormErrors;
  onChange: (patch: Partial<MqttConnectionForm>) => void;
}
