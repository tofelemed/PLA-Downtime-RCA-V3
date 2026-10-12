/**
 * Recognises the frontend's HTTP call shapes ("sinks") and the helper functions that forward a path
 * parameter to one of them ("wrappers"), so `usePeriodRead(id, 'x', `/production-periods/${id}/…`)`
 * is attributed to the path passed at the call site, not to the helper's `path` parameter.
 */
import * as ts from 'typescript';
import { HttpMethod } from './audit-types';

/** Where a value comes from: an expression at the sink, or an argument of the wrapper's caller. */
export type ValueRef =
  | { kind: 'expr'; expr: ts.Expression }
  | { kind: 'arg'; index: number; prop?: string }
  | { kind: 'none' };

export interface SinkSpec {
  client: 'v1' | 'v2';
  /** prefix the path is relative to: `/api` (v1, v2Request paths are `/api/v2`), `''` for v2 typed */
  prefix: string;
  method: HttpMethod | ValueRef;
  path: ValueRef;
  body: ValueRef;
  query: ValueRef;
  idempotencyKey: boolean;
  ifMatch: boolean | ValueRef;
}

const HTTP_VERBS: Record<string, HttpMethod> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
};

const NONE: ValueRef = { kind: 'none' };

function expr(e: ts.Expression | undefined): ValueRef {
  return e ? { kind: 'expr', expr: e } : NONE;
}

let checker: ts.TypeChecker | null = null;

/** Lets `propOf` follow `const args = { ... }` to its object literal. */
export function useChecker(next: ts.TypeChecker): void {
  checker = next;
}

function objectLiteralOf(
  arg: ts.Expression | undefined,
): ts.ObjectLiteralExpression | null {
  if (!arg) return null;
  if (ts.isObjectLiteralExpression(arg)) return arg;
  if (!ts.isIdentifier(arg) || !checker) return null;
  const decl = checker.getSymbolAtLocation(arg)?.valueDeclaration;
  const init =
    decl && ts.isVariableDeclaration(decl) ? decl.initializer : undefined;
  return init && ts.isObjectLiteralExpression(init) ? init : null;
}

/** Property `name` of an object-literal argument (or of the literal a local constant holds). */
export function propOf(
  argument: ts.Expression | undefined,
  name: string,
): ts.Expression | undefined {
  const arg = objectLiteralOf(argument);
  if (!arg) return undefined;
  for (const p of arg.properties) {
    if (ts.isPropertyAssignment(p) && p.name.getText() === name)
      return p.initializer;
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === name)
      return p.name;
  }
  return undefined;
}

function hasProp(arg: ts.Expression | undefined, name: string): boolean {
  return propOf(arg, name) !== undefined;
}

function methodRef(e: ts.Expression | undefined): HttpMethod | ValueRef {
  if (e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)))
    return e.text.toUpperCase() as HttpMethod;
  return expr(e);
}

function httpClientSink(
  verb: string,
  args: ts.NodeArray<ts.Expression>,
): SinkSpec {
  const base = { client: 'v1' as const, prefix: '/api', path: expr(args[0]) };
  if (verb === 'request')
    return {
      ...base,
      method: methodRef(propOf(args[1], 'method')) ?? 'GET',
      body: expr(propOf(args[1], 'body')),
      query: expr(propOf(args[1], 'query')),
      idempotencyKey: false,
      ifMatch: false,
    };
  const hasBody = verb === 'post' || verb === 'put' || verb === 'patch';
  return {
    ...base,
    method: HTTP_VERBS[verb],
    body: hasBody ? expr(args[1]) : NONE,
    query: verb === 'get' ? expr(propOf(args[1], 'params')) : NONE,
    idempotencyKey: false,
    ifMatch: false,
  };
}

function v2TypedSink(
  verb: string,
  args: ts.NodeArray<ts.Expression>,
): SinkSpec {
  return {
    client: 'v2',
    prefix: '',
    method: HTTP_VERBS[verb],
    path: expr(args[0]),
    body: expr(propOf(args[1], 'body')),
    query: expr(propOf(args[1], 'query')),
    idempotencyKey: verb === 'post',
    ifMatch: hasProp(args[1], 'ifMatch'),
  };
}

/** `v2Request({ method, path, ... })`: POSTs get a generated Idempotency-Key when none is passed. */
function v2RequestSink(arg: ts.Expression | undefined): SinkSpec {
  const ifMatch = propOf(arg, 'ifMatch');
  return {
    client: 'v2',
    prefix: '/api/v2',
    method: methodRef(propOf(arg, 'method')),
    path: expr(propOf(arg, 'path')),
    body: expr(propOf(arg, 'body')),
    query: expr(propOf(arg, 'query')),
    idempotencyKey: true,
    ifMatch: ifMatch ? expr(ifMatch) : false,
  };
}

function v2ListSink(arg: ts.Expression | undefined): SinkSpec {
  return {
    client: 'v2',
    prefix: '/api/v2',
    method: 'GET',
    path: expr(propOf(arg, 'path')),
    body: NONE,
    query: expr(propOf(arg, 'query')),
    idempotencyKey: false,
    ifMatch: false,
  };
}

/** The built-in sink a call expression is, or null. */
export function builtinSink(call: ts.CallExpression): SinkSpec | null {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) {
    if (callee.text === 'v2Request') return v2RequestSink(call.arguments[0]);
    if (callee.text === 'useV2InfiniteList')
      return v2ListSink(call.arguments[0]);
    return null;
  }
  if (!ts.isPropertyAccessExpression(callee)) return null;
  const receiver = callee.expression.getText();
  const verb = callee.name.text;
  if (receiver === 'httpClient' && (verb in HTTP_VERBS || verb === 'request'))
    return httpClientSink(verb, call.arguments);
  if (receiver === 'v2' && verb in HTTP_VERBS)
    return v2TypedSink(verb, call.arguments);
  return null;
}

/** Function-like declaration enclosing `node`. */
export function enclosingFunction(
  node: ts.Node,
): ts.SignatureDeclaration | null {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return null;
}

/** Base identifier and property of `x` / `x.prop` (casts and parentheses removed). */
function refTarget(
  ref: ValueRef,
): { base: ts.Identifier; prop?: string } | null {
  if (ref.kind !== 'expr') return null;
  let target = ref.expr;
  while (ts.isParenthesizedExpression(target) || ts.isAsExpression(target))
    target = target.expression;
  const prop = ts.isPropertyAccessExpression(target)
    ? target.name.text
    : undefined;
  const base = ts.isPropertyAccessExpression(target)
    ? target.expression
    : target;
  return ts.isIdentifier(base) ? { base, prop } : null;
}

function parameterIndex(fn: ts.SignatureDeclaration, name: string): number {
  return fn.parameters.findIndex(
    (p) => ts.isIdentifier(p.name) && p.name.text === name,
  );
}

/** When `ref` is (a property of) a parameter of `fn`, the matching argument reference at its call sites. */
export function parameterRef(
  ref: ValueRef,
  fn: ts.SignatureDeclaration,
): ValueRef | null {
  const target = refTarget(ref);
  if (!target) return null;
  const index = parameterIndex(fn, target.base.text);
  return index < 0 ? null : { kind: 'arg', index, prop: target.prop };
}

/** The (possibly outer) function whose parameter the path of a sink is. */
export function wrapperFunction(
  spec: SinkSpec,
  call: ts.Node,
): ts.SignatureDeclaration | null {
  const target = refTarget(spec.path);
  if (!target) return null;
  let fn = enclosingFunction(call);
  while (fn) {
    if (parameterIndex(fn, target.base.text) >= 0) return fn;
    fn = enclosingFunction(fn);
  }
  return null;
}

/** Rewrites a sink inside a wrapper so its parameter-derived parts point at the caller's arguments. */
export function toWrapperSpec(
  spec: SinkSpec,
  fn: ts.SignatureDeclaration,
): SinkSpec | null {
  const path = parameterRef(spec.path, fn);
  if (!path) return null;
  const lift = (ref: ValueRef): ValueRef => parameterRef(ref, fn) ?? ref;
  return {
    ...spec,
    path,
    method: typeof spec.method === 'string' ? spec.method : lift(spec.method),
    body: lift(spec.body),
    query: lift(spec.query),
    ifMatch:
      typeof spec.ifMatch === 'boolean' ? spec.ifMatch : lift(spec.ifMatch),
  };
}

/** Resolves an `arg` reference against a call's arguments (object-literal property when `prop`). */
export function resolveAgainst(
  ref: ValueRef,
  call: ts.CallExpression,
): ValueRef {
  if (ref.kind !== 'arg') return ref;
  const arg = call.arguments[ref.index];
  return expr(ref.prop ? propOf(arg, ref.prop) : arg);
}

/** Declaration node that names a wrapper: function declaration, method, or `const x = () => …`. */
export function declarationOf(fn: ts.SignatureDeclaration): ts.Node {
  const parent = fn.parent;
  if (
    (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) &&
    ts.isVariableDeclaration(parent)
  )
    return parent;
  return fn;
}
