/**
 * Names the function a call site belongs to (`taskApi.list`, `usePlans`) and finds the screens that
 * use it: references are followed through service / hook layers (up to `MAX_HOPS`) until they reach a
 * page, component or feature module.
 */
import * as ts from 'typescript';

const MAX_HOPS = 3;
const MAX_SCREENS = 6;
/** Layers whose references are followed further instead of being reported as a screen. */
const PASS_THROUGH = [/^src\/services\//, /^src\/api\//, /^src\/lib\//];

export interface CallerInfo {
  name: string;
  /** identifier the references are searched from */
  nameNode: ts.Node | null;
}

function classMemberName(member: ts.ClassElement): CallerInfo | null {
  const cls = member.parent;
  if (!ts.isClassLike(cls) || !member.name) return null;
  const className = cls.name?.text ?? 'class';
  return {
    name: `${className}.${member.name.getText()}`,
    nameNode: member.name,
  };
}

function objectMemberName(
  member: ts.PropertyAssignment | ts.MethodDeclaration,
): CallerInfo | null {
  const literal = member.parent;
  const holder = literal.parent;
  if (
    !ts.isObjectLiteralExpression(literal) ||
    !ts.isVariableDeclaration(holder)
  )
    return null;
  return {
    name: `${holder.name.getText()}.${member.name.getText()}`,
    nameNode: member.name,
  };
}

/**
 * Named declaration around `node`: the nearest class / exported-object member, else the outermost
 * function or top-level constant (inner `queryFn` / `run` arrows are skipped).
 */
export function callerOf(node: ts.Node): CallerInfo {
  let best: CallerInfo = { name: '(module)', nameNode: null };
  let current: ts.Node | undefined = node.parent;
  while (current && !ts.isSourceFile(current)) {
    const found = namedDeclaration(current);
    if (found && found.name.includes('.')) return found;
    if (found) best = found;
    current = current.parent;
  }
  return best;
}

function namedDeclaration(node: ts.Node): CallerInfo | null {
  if (ts.isFunctionDeclaration(node) && node.name)
    return { name: node.name.text, nameNode: node.name };
  if (
    (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node)) &&
    ts.isClassLike(node.parent)
  )
    return classMemberName(node);
  if (
    (ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node)) &&
    ts.isObjectLiteralExpression(node.parent)
  )
    return objectMemberName(node);
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    ts.isVariableStatement(node.parent.parent) &&
    ts.isSourceFile(node.parent.parent.parent)
  )
    return { name: node.name.text, nameNode: node.name };
  return null;
}

export class UsageFinder {
  private readonly memo = new Map<string, string[]>();

  constructor(
    private readonly service: ts.LanguageService,
    private readonly rel: (file: string) => string,
  ) {}

  /** Screen files (pages / components / features / contexts) that reach the caller. */
  screensFor(caller: CallerInfo): string[] {
    if (!caller.nameNode) return [];
    const found = this.walk(caller.nameNode, 0, new Set());
    return [...new Set(found)].sort().slice(0, MAX_SCREENS);
  }

  private walk(nameNode: ts.Node, hop: number, seen: Set<string>): string[] {
    const file = nameNode.getSourceFile().fileName;
    const key = `${file}:${nameNode.getStart()}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const cached = this.memo.get(key);
    if (cached) return cached;
    const result = this.referencesOf(file, nameNode.getStart()).flatMap((ref) =>
      this.follow(ref, hop, seen),
    );
    this.memo.set(key, result);
    return result;
  }

  private follow(ref: ts.Node, hop: number, seen: Set<string>): string[] {
    const relFile = this.rel(ref.getSourceFile().fileName);
    if (/\.(test|spec)\.tsx?$/.test(relFile) || relFile.startsWith('src/test/'))
      return [];
    if (!PASS_THROUGH.some((re) => re.test(relFile))) return [relFile];
    if (hop >= MAX_HOPS) return [];
    const outer = callerOf(ref);
    return outer.nameNode ? this.walk(outer.nameNode, hop + 1, seen) : [];
  }

  private referencesOf(file: string, position: number): ts.Node[] {
    const program = this.service.getProgram();
    const refs = this.service.findReferences(file, position) ?? [];
    return refs
      .flatMap((r) => r.references)
      .filter((r) => !r.isDefinition)
      .flatMap((r) => {
        const source = program?.getSourceFile(r.fileName);
        if (!source) return [];
        const token = findToken(source, r.textSpan.start);
        return token ? [token] : [];
      });
  }
}

export function findToken(
  source: ts.SourceFile,
  position: number,
): ts.Node | null {
  const visit = (node: ts.Node): ts.Node | null => {
    if (position < node.getStart(source) || position >= node.getEnd())
      return null;
    return ts.forEachChild(node, visit) ?? node;
  };
  return visit(source);
}
