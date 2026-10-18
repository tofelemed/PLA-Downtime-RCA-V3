/** What decided a stop's stored impact (plan 1.10 `impactBasis`), with the event facts its wording needs. */
export interface ImpactBasisFacts {
  /** `stated`, `default`, `unit_rule` or `standby_takeover`; '' = none (create, older server) */
  basis: string;
  sourceKind: string | null;
  /** the source in words ("State engine", "PI") */
  source: string | null;
  /** the stop's asset as "name (code)" (`assetLabel`); null = a unit-level stop */
  assetName: string | null;
}

/**
 * Marun E2E 1.5: the impact's basis in words, from the stored basis (never from the source label alone):
 * the approved unit impact rule, a standby takeover, a person's statement, or the source / state engine
 * default. null = a manual stop on the default (nothing to say).
 */
export function impactBasisText(facts: ImpactBasisFacts): string | null {
  switch (facts.basis) {
    case 'unit_rule':
      return `From the approved impact rule for ${facts.assetName ?? 'the unit'}`;
    case 'standby_takeover':
      return 'Set because the standby took over in time';
    case 'stated':
      return 'Stated by a person';
    case 'default':
      return defaultText(facts);
    default:
      return null;
  }
}

function defaultText(facts: ImpactBasisFacts): string | null {
  const source = facts.source?.trim() || null;
  if (facts.sourceKind === 'derived') return `Derived from the unit state by ${source ?? 'the state engine'}`;
  if (facts.sourceKind === 'source' || facts.sourceKind === 'imported') return `From ${source ?? 'the source system'}`;
  return null;
}

/** "Main drive and gearbox (EXT1-Main)": the asset's name with its code (Marun regression); either alone when the other is missing or equal. */
export function assetLabel(asset: { name: string | null; code: string | null } | undefined): string | null {
  if (!asset) return null;
  const name = trimmed(asset.name);
  const code = trimmed(asset.code);
  if (name && code && name !== code) return `${name} (${code})`;
  return name ?? code;
}

const trimmed = (value: string | null): string | null => value?.trim() || null;
