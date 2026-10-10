/** Thrown when a match needs more steps than the remaining budget allows. */
export class RuleBudgetExceeded extends Error {
  constructor() {
    super('Rule evaluation exceeded its step budget');
    this.name = 'RuleBudgetExceeded';
  }
}

/** Mutable step counter shared by one evaluation (NFR02 bounded execution cost). */
export class StepBudget {
  private used = 0;

  constructor(private readonly limit: number) {}

  spend(steps = 1): void {
    this.used += steps;
    if (this.used > this.limit) throw new RuleBudgetExceeded();
  }

  get steps(): number {
    return this.used;
  }
}

interface Token {
  kind: 'literal' | 'one' | 'many';
  char: string;
}

/** `*` any run, `?` one character, `\` escapes the next character; everything else is literal. */
function tokenize(pattern: string): Token[] {
  const tokens: Token[] = [];
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '\\' && index + 1 < pattern.length) {
      index += 1;
      tokens.push({ kind: 'literal', char: pattern[index].toLowerCase() });
    } else if (char === '*') tokens.push({ kind: 'many', char });
    else if (char === '?') tokens.push({ kind: 'one', char });
    else tokens.push({ kind: 'literal', char: char.toLowerCase() });
  }
  return tokens;
}

/**
 * Case-insensitive glob match without regular expressions (two-pointer backtracking over the last `*`),
 * at most O(text × pattern) steps, each charged to the budget.
 */
export function globMatches(
  pattern: string,
  text: string,
  budget: StepBudget,
): boolean {
  const tokens = tokenize(pattern);
  const value = text.toLowerCase();
  let t = 0;
  let p = 0;
  let star = -1;
  let resume = 0;
  while (t < value.length) {
    budget.spend();
    const token = tokens[p];
    if (
      token &&
      (token.kind === 'one' ||
        (token.kind === 'literal' && token.char === value[t]))
    ) {
      t += 1;
      p += 1;
    } else if (token?.kind === 'many') {
      star = p;
      resume = t;
      p += 1;
    } else if (star >= 0) {
      p = star + 1;
      resume += 1;
      t = resume;
    } else return false;
  }
  while (tokens[p]?.kind === 'many') p += 1;
  return p === tokens.length;
}
