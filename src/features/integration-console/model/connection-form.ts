import type { ConnectionCreateBody, ConnectionUpdateBody } from '@/api/v2/queries/integration-connections';
import type { ConnectionView } from '@/api/v2/types/integrations';

/**
 * PI connection form (plan 3.7). The credential is write-only: it is typed once, sent in the create or
 * change body, never pre-filled, never stored in the browser and never read back (the API answers
 * `hasSecret` only). Endpoint settings never hold credentials (the API refuses them: SECRET_IN_CONFIG).
 */
export interface PiConnectionForm {
  displayName: string;
  piWebApiUrl: string;
  username: string;
  afDatabasePath: string;
  allowInsecureTls: boolean;
  /** new credential; empty = none (create) or keep the stored one (edit) */
  secret: string;
}

export type PiFormErrors = Partial<Record<keyof PiConnectionForm, string>>;

export function emptyPiForm(): PiConnectionForm {
  return { displayName: '', piWebApiUrl: '', username: '', afDatabasePath: '', allowInsecureTls: false, secret: '' };
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The form of a stored connection; the secret field always starts empty. */
export function formFromConnection(connection: ConnectionView): PiConnectionForm {
  const config = connection.endpointConfig;
  return {
    displayName: connection.displayName,
    piWebApiUrl: text(config.piWebApiUrl),
    username: text(config.username),
    afDatabasePath: text(config.afDatabasePath),
    allowInsecureTls: config.allowInsecureTls === true,
    secret: '',
  };
}

export function piFormErrors(form: PiConnectionForm): PiFormErrors {
  const errors: PiFormErrors = {};
  if (form.displayName.trim() === '') errors.displayName = 'Name is required';
  if (!/^https?:\/\/\S+$/i.test(form.piWebApiUrl.trim())) errors.piWebApiUrl = 'Enter the PI Web API base URL (http or https)';
  return errors;
}

/** Endpoint configuration without credentials (secrets travel only as `secret`). */
export function piEndpointConfig(form: PiConnectionForm): Record<string, unknown> {
  const config: Record<string, unknown> = { piWebApiUrl: form.piWebApiUrl.trim() };
  if (form.username.trim()) config.username = form.username.trim();
  if (form.afDatabasePath.trim()) config.afDatabasePath = form.afDatabasePath.trim();
  if (form.allowInsecureTls) config.allowInsecureTls = true;
  return config;
}

export function piCreateBody(form: PiConnectionForm): ConnectionCreateBody {
  return {
    sourceType: 'pi_web_api',
    displayName: form.displayName.trim(),
    endpointConfig: piEndpointConfig(form),
    isActive: true,
    ...(form.secret ? { secret: form.secret } : {}),
  };
}

const sameConfig = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/** Only what changed; null when nothing did. A typed secret replaces the stored one. */
export function piUpdateBody(form: PiConnectionForm, connection: ConnectionView): ConnectionUpdateBody | null {
  const body: ConnectionUpdateBody = {};
  const config = piEndpointConfig(form);
  if (form.displayName.trim() !== connection.displayName) body.displayName = form.displayName.trim();
  if (!sameConfig(config, connection.endpointConfig)) body.endpointConfig = config;
  if (form.secret) body.secret = form.secret;
  return Object.keys(body).length > 0 ? body : null;
}
