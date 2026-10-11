import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '../../components/field';
import { NativeSelect } from '../../components/native-select';
import { TLS_MODES, type TlsMode } from '../model/mqtt-form';
import type { StepProps } from './step-props';

const MODE_LABELS: Record<TlsMode, string> = {
  system: 'System trust store',
  caPem: 'CA certificate pasted (PEM)',
  caRef: 'CA certificate by secret reference',
  insecure: 'Insecure: no certificate verification (dev only, logged on every connect)',
};

/** TLS trust block of an mqtts:// broker: exactly one trust mode; the PEM may never hold a private key. */
export function TlsFields({ form, errors, onChange }: StepProps) {
  return (
    <fieldset className="space-y-3 rounded-md border p-3" data-testid="mqtt-tls">
      <legend className="px-1 text-sm font-medium">TLS (mqtts://)</legend>
      <Field id="mqtt-tls-mode" label="Trust mode" error={errors.tlsMode}>
        <NativeSelect id="mqtt-tls-mode" testId="mqtt-tls-mode" value={form.tlsMode} options={TLS_MODES.map((mode) => ({ value: mode, label: MODE_LABELS[mode] }))} onChange={(mode) => onChange({ tlsMode: mode as TlsMode })} />
      </Field>
      {form.tlsMode === 'insecure' && (
        <p className="text-xs text-destructive" role="alert">
          Insecure mode disables certificate verification; the server refuses it outside development.
        </p>
      )}
      {form.tlsMode === 'caPem' && (
        <Field id="mqtt-ca-pem" label="CA certificate (PEM)" error={errors.caPem} hint="BEGIN CERTIFICATE block(s) only, at most 64 KB; never a private key.">
          <Textarea id="mqtt-ca-pem" rows={5} className="font-mono text-xs" value={form.caPem} onChange={(event) => onChange({ caPem: event.target.value })} />
        </Field>
      )}
      {form.tlsMode === 'caRef' && (
        <Field id="mqtt-ca-ref" label="CA secret reference" error={errors.caRef} hint="secrets:<id> of a stored CA certificate.">
          <Input id="mqtt-ca-ref" value={form.caRef} onChange={(event) => onChange({ caRef: event.target.value })} />
        </Field>
      )}
      {form.tlsMode !== 'system' && (
        <Field
          id="mqtt-servername"
          label="Server name override (SNI, optional)"
          error={errors.servername}
          hint="The name the certificate is checked against. Only honoured for brokers given by IP address (mqtt.js uses the URL host otherwise)."
        >
          <Input id="mqtt-servername" value={form.servername} onChange={(event) => onChange({ servername: event.target.value })} />
        </Field>
      )}
    </fieldset>
  );
}
