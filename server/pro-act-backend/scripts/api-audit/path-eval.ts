/**
 * Static evaluation of the frontend's URL expressions into path templates (`/tasks/{id}`): string
 * literals, template strings, `+` concatenation, constants and class fields with literal initialisers,
 * and string-literal unions (expanded into one template per member). Anything else becomes `{name}`.
 */
import * as ts from 'typescript';

const MAX_VARIANTS = 24;

function product(left: string[], right: string[]): string[] {
  const out: string[] = [];
  for (const a of left) for (const b of right) out.push(a + b);
  return out.slice(0, MAX_VARIANTS);
}

function unwrap(expr: ts.Expression): ts.Expression {
  let current = expr;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current)
  )
    current = current.expression;
  return current;
}

/** Last identifier of an expression (`input.period.periodId` → `periodId`). */
export function nameOf(expr: ts.Expression): string {
  const inner = unwrap(expr);
  if (ts.isIdentifier(inner)) return inner.text;
  if (ts.isPropertyAccessExpression(inner)) return inner.name.text;
  if (ts.isElementAccessExpression(inner)) return nameOf(inner.expression);
  if (ts.isBinaryExpression(inner)) return nameOf(inner.left);
  if (ts.isCallExpression(inner) && inner.arguments[0])
    return nameOf(inner.arguments[0]);
  return 'param';
}

/** Arguments one call site binds to a helper's parameters. */
export type Bindings = Map<ts.ParameterDeclaration, ts.Expression>;

export class PathEvaluator {
  private env: Bindings = new Map();

  constructor(private readonly checker: ts.TypeChecker) {}

  /** Path templates an expression can produce (query strings dropped), parameters bound by `env`. */
  templates(expr: ts.Expression, env: Bindings = new Map()): string[] {
    this.env = env;
    try {
      return [...new Set(this.evaluate(expr, 0).map(normalizeTemplate))];
    } finally {
      this.env = new Map();
    }
  }

  /** Parameter declaration an identifier names, when it is a parameter. */
  parameterOf(expr: ts.Expression): ts.ParameterDeclaration | null {
    const inner = unwrap(expr);
    if (!ts.isIdentifier(inner)) return null;
    const decl = this.checker.getSymbolAtLocation(inner)?.valueDeclaration;
    return decl && ts.isParameter(decl) ? decl : null;
  }

  private evaluate(expr: ts.Expression, depth: number): string[] {
    const inner = unwrap(expr);
    if (depth > 8) return [`{${nameOf(inner)}}`];
    if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner))
      return [inner.text];
    if (ts.isTemplateExpression(inner)) return this.template(inner, depth);
    if (
      ts.isBinaryExpression(inner) &&
      inner.operatorToken.kind === ts.SyntaxKind.PlusToken
    )
      return product(
        this.evaluate(inner.left, depth + 1),
        this.evaluate(inner.right, depth + 1),
      );
    if (ts.isConditionalExpression(inner))
      return [
        ...this.evaluate(inner.whenTrue, depth + 1),
        ...this.evaluate(inner.whenFalse, depth + 1),
      ];
    return this.atom(inner, depth);
  }

  private template(expr: ts.TemplateExpression, depth: number): string[] {
    let parts = [expr.head.text];
    for (const span of expr.templateSpans) {
      parts = product(parts, this.atom(unwrap(span.expression), depth + 1));
      parts = product(parts, [span.literal.text]);
    }
    return parts;
  }

  /** An identifier, property access or call inside a path. */
  private atom(expr: ts.Expression, depth: number): string[] {
    const initializer = this.literalInitializer(expr);
    if (initializer) return this.evaluate(initializer, depth + 1);
    const param = this.parameterOf(expr);
    const bound = param ? this.env.get(param) : undefined;
    if (bound) return this.evaluate(bound, depth + 1);
    const literals = this.literalUnion(expr);
    if (literals) return literals;
    return [`{${nameOf(expr)}}`];
  }

  /** Initializer of a `const` / class field the expression names, when it is a string expression. */
  private literalInitializer(expr: ts.Expression): ts.Expression | null {
    if (!ts.isIdentifier(expr) && !ts.isPropertyAccessExpression(expr))
      return null;
    const symbol = this.checker.getSymbolAtLocation(
      ts.isPropertyAccessExpression(expr) ? expr.name : expr,
    );
    const resolved =
      symbol && symbol.flags & ts.SymbolFlags.Alias
        ? this.checker.getAliasedSymbol(symbol)
        : symbol;
    const decl = resolved?.valueDeclaration;
    if (!decl) return null;
    const init =
      ts.isVariableDeclaration(decl) ||
      ts.isPropertyDeclaration(decl) ||
      ts.isPropertyAssignment(decl)
        ? decl.initializer
        : undefined;
    if (!init) return null;
    const inner = unwrap(init);
    const stringy =
      ts.isStringLiteral(inner) ||
      ts.isNoSubstitutionTemplateLiteral(inner) ||
      ts.isTemplateExpression(inner) ||
      ts.isBinaryExpression(inner);
    return stringy ? inner : null;
  }

  private literalUnion(expr: ts.Expression): string[] | null {
    const type = this.checker.getTypeAtLocation(expr);
    const members = type.isUnion() ? type.types : [type];
    const values = members.map((t) => (t.isStringLiteral() ? t.value : null));
    if (values.some((v) => v === null) || values.length === 0) return null;
    return (values as string[]).slice(0, MAX_VARIANTS);
  }
}

/** `/api//x/?a=1` → `/api/x`; parameters keep their names. */
export function normalizeTemplate(raw: string): string {
  // a placeholder glued to the end of a segment is a query-string suffix (`/tasks${qs}`)
  const noQuery = raw.split('?')[0].replace(/([^/])\{[^}]+\}$/, '$1');
  const collapsed = noQuery.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return collapsed.startsWith('/') ? collapsed : `/${collapsed}`;
}
