import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT_PREVIEW_KEY = 'skipAuditPreview';

/**
 * A write route whose body may ask for a dry run (`preview: true`, e.g. bulk code): such a request changes
 * nothing, so the auto-audit does not record it as a create (QA audit F5); the real apply is still audited.
 */
export const SkipAuditOnPreview = () =>
  SetMetadata(SKIP_AUDIT_PREVIEW_KEY, true);

/** True when the request body asks for a preview only. */
export function isPreviewBody(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { preview?: unknown }).preview === true
  );
}
