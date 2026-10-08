import {
  compileGlob,
  MappingRule,
  MatchKind,
  normalizePath,
  normalizeSourceId,
} from './mapping-rule';

/** What a source delivered about where an observation belongs. */
export interface MappingSample {
  sourceId?: string | null;
  sourcePath?: string | null;
  /** the referenced AF element first, then its ancestors (closest first) */
  afElementWebIds?: readonly string[] | null;
}

export type MappingResolution =
  | { status: 'mapped'; tier: MatchKind; rule: MappingRule }
  | { status: 'ambiguous'; tier: MatchKind; candidates: MappingRule[] }
  | { status: 'unmapped' };

interface CompiledPattern {
  rule: MappingRule;
  regex: RegExp;
}

/**
 * Deterministic source → target resolution (ING03). Tiers, first hit wins: exact source id → exact
 * normalised path → patterns (highest precedence that matches) → AF bindings (the element, then its
 * ancestors). Inside a tier a rule for the caller's connection beats an "any connection" rule; hits that
 * still point at different targets are ambiguous and never resolved by picking one.
 */
export class MappingResolver {
  private readonly byId = new Map<string, MappingRule[]>();
  private readonly byPath = new Map<string, MappingRule[]>();
  private readonly byWebId = new Map<string, MappingRule[]>();
  private readonly patterns: CompiledPattern[] = [];

  constructor(rules: readonly MappingRule[]) {
    for (const rule of rules) {
      this.index(rule);
    }
  }

  resolve(sample: MappingSample): MappingResolution {
    const sourceId = sample.sourceId ? normalizeSourceId(sample.sourceId) : '';
    const path = sample.sourcePath ? normalizePath(sample.sourcePath) : '';
    const exact =
      decide('exact_id', sourceId ? this.byId.get(sourceId) : undefined) ??
      decide('exact_path', path ? this.byPath.get(path) : undefined);
    if (exact) return exact;
    const pattern = decide('pattern', this.patternHits(path, sourceId));
    if (pattern) return pattern;
    for (const webId of sample.afElementWebIds ?? []) {
      const binding = decide('af_binding', this.byWebId.get(webId.trim()));
      if (binding) return binding;
    }
    return { status: 'unmapped' };
  }

  private index(rule: MappingRule): void {
    if (rule.kind === 'pattern') {
      this.patterns.push({ rule, regex: compileGlob(rule.normalizedValue) });
      return;
    }
    const target =
      rule.kind === 'exact_id'
        ? this.byId
        : rule.kind === 'exact_path'
          ? this.byPath
          : this.byWebId;
    const list = target.get(rule.normalizedValue) ?? [];
    list.push(rule);
    target.set(rule.normalizedValue, list);
  }

  /** Patterns matching the path (or the id) with the highest precedence among the matches. */
  private patternHits(path: string, sourceId: string): MappingRule[] {
    const subjects = [path, sourceId.toLowerCase()].filter(Boolean);
    const hits = this.patterns
      .filter(({ regex }) => subjects.some((subject) => regex.test(subject)))
      .map(({ rule }) => rule);
    if (hits.length === 0) return [];
    const top = Math.max(...hits.map((rule) => rule.precedence));
    return hits.filter((rule) => rule.precedence === top);
  }
}

/** One tier's verdict: null when the tier has no hit. */
function decide(
  tier: MatchKind,
  hits: readonly MappingRule[] | undefined,
): MappingResolution | null {
  if (!hits || hits.length === 0) return null;
  const specific = hits.filter((rule) => rule.connectionId !== null);
  const pool = ordered(specific.length > 0 ? specific : hits);
  const targets = new Set(
    pool.map((rule) => `${rule.targetType}:${rule.targetId}`),
  );
  if (targets.size > 1) {
    return { status: 'ambiguous', tier, candidates: pool };
  }
  return { status: 'mapped', tier, rule: pool[0] };
}

/** Stable order: `source_mappings` rules before `af_bindings` rows, then by id. */
function ordered(rules: readonly MappingRule[]): MappingRule[] {
  return [...rules].sort((a, b) =>
    a.origin === b.origin
      ? a.id.localeCompare(b.id)
      : a.origin === 'source_mapping'
        ? -1
        : 1,
  );
}
