import { v2BaseUrl, v2Session } from '@/api/v2/config';
import { toV2Error } from '@/api/v2/errors';
import { newIdempotencyKey } from '@/api/v2/idempotency';
import type { RcaAttachmentView } from '@/api/v2/types/rca';

/**
 * Evidence files of a case (`POST/GET /v2/rcas/{id}/attachments`). The JSON client cannot send
 * multipart or read binary bodies, so these two calls use `fetch` with the same session headers.
 */
function headers(): Headers {
  const session = v2Session();
  const result = new Headers({ 'X-Correlation-Id': newIdempotencyKey() });
  const token = session.getAccessToken();
  if (token) result.set('Authorization', `Bearer ${token}`);
  const tenantId = session.getTenantId();
  if (tenantId) result.set('X-Tenant-Id', tenantId);
  return result;
}

const fileUrl = (rcaId: string, suffix = '') => `${v2BaseUrl()}/rcas/${encodeURIComponent(rcaId)}/attachments${suffix}`;

async function failure(response: Response): Promise<never> {
  const body: unknown = await response.json().catch(() => undefined);
  throw toV2Error(response.status, body, response.headers.get('ETag'), response.headers.get('X-Correlation-Id') ?? '');
}

/** Stores one file (25 MiB, documents / images / videos); reference it from an evidence item, then save. */
export async function uploadRcaFile(rcaId: string, file: File): Promise<RcaAttachmentView> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(fileUrl(rcaId), { method: 'POST', headers: headers(), body: form });
  if (!response.ok) return failure(response);
  return (await response.json()) as RcaAttachmentView;
}

/** Downloads a referenced file and saves it under its original name. */
export async function downloadRcaFile(rcaId: string, fileName: string, name: string): Promise<void> {
  const response = await fetch(fileUrl(rcaId, `/${encodeURIComponent(fileName)}`), { headers: headers() });
  if (!response.ok) return failure(response);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
