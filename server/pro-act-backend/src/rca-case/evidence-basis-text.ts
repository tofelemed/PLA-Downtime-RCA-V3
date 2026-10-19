/** "(the policy default, SME V8)" and the like: a claim plus an internal spec reference (QA M3). */
const POLICY_DEFAULT_NOTE =
  /\s*\((?:the )?policy default(?:,\s*SME\s+[A-Z]{1,3}\d+)?\)/gi;
/** A bare internal reference left in a sentence (", SME V8", "SME CA9"). */
const SPEC_REF = /,?\s*\bSME\s+[A-Z]{1,3}\d+\b/g;

/**
 * The basis sentence of a frozen evidence package as a reader sees it: packages linked before 19 Oct 2026
 * stored "(the policy default, SME V8)" after the view; the frozen figures stay as stored, the words drop
 * the internal reference and the "policy default" claim (the view is named by the package's `view`).
 */
export function publicBasis(text: string): string {
  return text.replace(POLICY_DEFAULT_NOTE, '').replace(SPEC_REF, '').trim();
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A link's stored evidence package with its approved-impact basis in reader's words (never rewritten). */
export function publicEvidence(
  evidence: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const impact = evidence?.approvedImpact;
  if (!evidence || !isRecord(impact) || typeof impact.basis !== 'string')
    return evidence;
  return {
    ...evidence,
    approvedImpact: { ...impact, basis: publicBasis(impact.basis) },
  };
}
