import type { SupportReferenceInfo } from './describe-error';

/** One line for a support ticket; the only place the code, status and correlation id appear. */
export function supportReferenceText(reference: SupportReferenceInfo, now: Date = new Date()): string {
  const part = (value: string | number | null) => (value === null ? '-' : String(value));
  return `Traverse Forge support reference: code=${part(reference.code)} status=${part(reference.status)} ref=${part(reference.correlationId)} at=${now.toISOString()}`;
}
