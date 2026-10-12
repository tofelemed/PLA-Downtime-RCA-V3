/**
 * Frontend call inventory of the audit: type-checks the frontend (`tsconfig.app.json`) and records every
 * call through `httpClient` (v1), `v2.*`, `v2Request` and `useV2InfiniteList` (v2), including calls made
 * through helpers that forward a path parameter, with the body / query fields their types declare.
 */
import * as ts from 'typescript';
import { readFileSync, existsSync } from 'fs';
import { dirname, join, relative } from 'path';
import { FrontendCall, HttpMethod } from './audit-types';
import {
  builtinSink,
  declarationOf,
  resolveAgainst,
  SinkSpec,
  toWrapperSpec,
  useChecker,
  ValueRef,
  wrapperFunction,
} from './frontend-sinks';
import { Bindings, PathEvaluator } from './path-eval';
import { callerOf, findToken, UsageFinder } from './usage-finder';

/** Client infrastructure: their internal fetches are the sinks themselves, not product calls. */
const INFRASTRUCTURE = [
  'src/services/api/httpClient.ts',
  'src/api/v2/client.ts',
  'src/api/v2/v2.ts',
  'src/api/v2/queries/use-v2-list.ts',
];

function isProductSource(rel: string): boolean {
  return (
    rel.startsWith('src/') &&
    !rel.startsWith('src/test/') &&
    !/\.(test|spec)\.tsx?$/.test(rel) &&
    !rel.endsWith('.d.ts') &&
    !INFRASTRUCTURE.includes(rel)
  );
}

function createService(frontendRoot: string): ts.LanguageService {
  const configPath = join(frontendRoot, 'tsconfig.app.json');
  const config = ts.readConfigFile(configPath, (p) => ts.sys.readFile(p));
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    dirname(configPath),
  );
  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: () => '1',
    getScriptSnapshot: (file) =>
      existsSync(file)
        ? ts.ScriptSnapshot.fromString(readFileSync(file, 'utf8'))
        : undefined,
    getCurrentDirectory: () => frontendRoot,
    getCompilationSettings: () => ({ ...parsed.options, noEmit: true }),
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: (p) => ts.sys.fileExists(p),
    readFile: (p) => ts.sys.readFile(p),
    readDirectory: (...args) => ts.sys.readDirectory(...args),
    directoryExists: (p) => ts.sys.directoryExists(p),
    getDirectories: (p) => ts.sys.getDirectories(p),
  };
  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

interface FieldInfo {
  fields: string[] | null;
  untyped: boolean;
}

export class FrontendInventory {
  private readonly service: ts.LanguageService;
  private readonly program: ts.Program;
  private readonly checker: ts.TypeChecker;
  private readonly paths: PathEvaluator;
  private readonly wrappers = new Map<ts.Node, SinkSpec>();
  private readonly usage: UsageFinder;

  constructor(private readonly frontendRoot: string) {
    this.service = createService(frontendRoot);
    const program = this.service.getProgram();
    if (!program) throw new Error('frontend program could not be created');
    this.program = program;
    this.checker = program.getTypeChecker();
    useChecker(this.checker);
    this.paths = new PathEvaluator(this.checker);
    this.usage = new UsageFinder(this.service, (f) => this.rel(f));
  }

  /** Identifiers inside a path expression. */
  private identifiersIn(expr: ts.Node): ts.Identifier[] {
    const out: ts.Identifier[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node)) out.push(node);
      ts.forEachChild(node, visit);
    };
    visit(expr);
    return out;
  }

  /** Calls of the function that declares `param`. */
  private callSitesOf(param: ts.ParameterDeclaration): ts.CallExpression[] {
    const decl = declarationOf(param.parent) as ts.Node & { name?: ts.Node };
    if (!decl.name) return [];
    const refs =
      this.service.getReferencesAtPosition(
        decl.getSourceFile().fileName,
        decl.name.getStart(),
      ) ?? [];
    return refs.flatMap((ref) => {
      const source = this.program.getSourceFile(ref.fileName);
      const token = source ? findToken(source, ref.textSpan.start) : null;
      const parent = token?.parent;
      return parent &&
        ts.isCallExpression(parent) &&
        parent.expression === token
        ? [parent]
        : [];
    });
  }

  /**
   * Bindings per call site when the path uses a non-id parameter that callers pass as a literal
   * (`useCodeDetail(library, id, 'versions')`): one evaluation per site keeps parameters correlated.
   */
  private bindingSets(pathExpr: ts.Expression): Bindings[] {
    const params = this.identifiersIn(pathExpr)
      .filter((id) => !/id$/i.test(id.text))
      .map((id) => this.paths.parameterOf(id))
      .filter((p): p is ts.ParameterDeclaration => p !== null);
    for (const param of params) {
      const sites = this.callSitesOf(param);
      const index = param.parent.parameters.indexOf(param);
      if (
        !sites.length ||
        !sites.every(
          (c) =>
            c.arguments[index] && ts.isStringLiteralLike(c.arguments[index]),
        )
      )
        continue;
      return sites.map((site) => {
        const env: Bindings = new Map();
        param.parent.parameters.forEach(
          (p, i) => site.arguments[i] && env.set(p, site.arguments[i]),
        );
        return env;
      });
    }
    return [new Map<ts.ParameterDeclaration, ts.Expression>()];
  }

  private templatesOf(pathExpr: ts.Expression): string[] {
    const all = this.bindingSets(pathExpr).flatMap((env) =>
      this.paths.templates(pathExpr, env),
    );
    return [...new Set(all)].filter((t) => !t.startsWith('/http'));
  }

  rel(file: string): string {
    return relative(this.frontendRoot, file).replace(/\\/g, '/');
  }

  private sources(): ts.SourceFile[] {
    return this.program
      .getSourceFiles()
      .filter((s) => isProductSource(this.rel(s.fileName)));
  }

  private calls(): ts.CallExpression[] {
    const out: ts.CallExpression[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) out.push(node);
      ts.forEachChild(node, visit);
    };
    this.sources().forEach((s) => visit(s));
    return out;
  }

  /** The sink spec of a call: built-in client, or a known wrapper with its arguments resolved. */
  private sinkOf(call: ts.CallExpression): SinkSpec | null {
    const builtin = builtinSink(call);
    if (builtin) return builtin;
    const callee = ts.isPropertyAccessExpression(call.expression)
      ? call.expression.name
      : call.expression;
    let symbol = this.checker.getSymbolAtLocation(callee);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias)
      symbol = this.checker.getAliasedSymbol(symbol);
    const decl = symbol?.valueDeclaration;
    const wrapper = decl ? this.wrappers.get(decl) : undefined;
    if (!wrapper) return null;
    const lift = (ref: ValueRef) => resolveAgainst(ref, call);
    return {
      ...wrapper,
      path: lift(wrapper.path),
      method:
        typeof wrapper.method === 'string'
          ? wrapper.method
          : lift(wrapper.method),
      body: lift(wrapper.body),
      query: lift(wrapper.query),
      ifMatch:
        typeof wrapper.ifMatch === 'boolean'
          ? wrapper.ifMatch
          : lift(wrapper.ifMatch),
    };
  }

  /** Registers helpers that forward a path parameter to a sink, until no new helper appears. */
  private discoverWrappers(calls: ts.CallExpression[]): void {
    for (let pass = 0; pass < 5; pass += 1) {
      const before = this.wrappers.size;
      for (const call of calls) {
        const spec = this.sinkOf(call);
        const fn = spec ? wrapperFunction(spec, call) : null;
        const wrapped = spec && fn ? toWrapperSpec(spec, fn) : null;
        if (wrapped && fn) this.wrappers.set(declarationOf(fn), wrapped);
      }
      if (this.wrappers.size === before) return;
    }
  }

  /** `fetch(...)` calls outside the API clients (third-party / user-configured URLs; informational). */
  externalFetches(): Array<{ location: string; target: string }> {
    return this.calls()
      .filter(
        (c) =>
          ts.isIdentifier(c.expression) &&
          c.expression.text === 'fetch' &&
          c.arguments[0],
      )
      .map((c) => {
        const source = c.getSourceFile();
        const line =
          source.getLineAndCharacterOfPosition(c.getStart()).line + 1;
        return {
          location: `${this.rel(source.fileName)}:${line}`,
          target: c.arguments[0].getText().slice(0, 80),
        };
      });
  }

  build(): FrontendCall[] {
    const calls = this.calls();
    this.discoverWrappers(calls);
    const records: FrontendCall[] = [];
    for (const call of calls) {
      const spec = this.sinkOf(call);
      if (!spec || spec.path.kind !== 'expr') continue;
      const fn = wrapperFunction(spec, call);
      if (fn && this.wrappers.has(declarationOf(fn))) continue;
      records.push(...this.recordsFor(call, spec));
    }
    return records;
  }

  private recordsFor(call: ts.CallExpression, spec: SinkSpec): FrontendCall[] {
    if (spec.path.kind !== 'expr') return [];
    const source = call.getSourceFile();
    const line = source.getLineAndCharacterOfPosition(call.getStart()).line + 1;
    const caller = callerOf(call);
    const body =
      spec.body.kind === 'expr'
        ? this.fieldsOf(spec.body.expr)
        : { fields: null, untyped: false };
    const query =
      spec.query.kind === 'expr'
        ? (this.fieldsOf(spec.query.expr).fields ?? [])
        : [];
    const usedBy = this.usage.screensFor(caller);
    const templates = this.templatesOf(spec.path.expr);
    return this.methodsOf(spec).flatMap((method) =>
      templates.map((template) => ({
        method,
        path: `${spec.prefix}${template}`.replace(/\/+$/, '') || '/',
        location: `${this.rel(source.fileName)}:${line}`,
        caller: caller.name,
        client: spec.client,
        bodyFields: body.fields,
        bodyUntyped: body.untyped,
        queryFields: query,
        sendsIdempotencyKey: spec.idempotencyKey && method === 'POST',
        sendsIfMatch:
          typeof spec.ifMatch === 'boolean'
            ? spec.ifMatch
            : spec.ifMatch.kind === 'expr',
        usedBy,
      })),
    );
  }

  private methodsOf(spec: SinkSpec): HttpMethod[] {
    if (typeof spec.method === 'string') return [spec.method];
    if (spec.method.kind !== 'expr') return ['GET'];
    const type = this.checker.getTypeAtLocation(spec.method.expr);
    const members = type.isUnion() ? type.types : [type];
    const literals = members
      .filter((t) => t.isStringLiteral())
      .map((t) => t.value.toUpperCase());
    return literals.length ? (literals as HttpMethod[]) : ['GET'];
  }

  /** Property names a body / query expression's type declares (`untyped` when it is open). */
  private fieldsOf(expr: ts.Expression): FieldInfo {
    const type = this.checker.getNonNullableType(
      this.checker.getTypeAtLocation(expr),
    );
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
      return { fields: null, untyped: true };
    const name = type.getSymbol()?.getName();
    if (
      name === 'FormData' ||
      name === 'Array' ||
      this.checker.isArrayType(type)
    )
      return { fields: null, untyped: false };
    const members = type.isUnion() ? type.types : [type];
    const open = members.some(
      (t) => this.checker.getIndexInfosOfType(t).length > 0,
    );
    const fields = new Set<string>();
    members.forEach((t) =>
      this.checker
        .getPropertiesOfType(t)
        .forEach((p) => fields.add(p.getName())),
    );
    return { fields: [...fields].sort(), untyped: open };
  }
}
