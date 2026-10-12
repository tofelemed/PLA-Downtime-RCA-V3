/**
 * Backend route inventory of the audit: walks the module tree of `AppModule` (no DI container, no
 * database) and reads each handler's route, roles, `@Public()`, `@Idempotent()`, `@IfMatch()` and the
 * whitelisted fields of its `@Body()` DTO (what the global ValidationPipe accepts).
 */
import 'reflect-metadata';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { RequestMethod, Type } from '@nestjs/common';
import {
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
  VERSION_METADATA,
} from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { getMetadataStorage } from 'class-validator';
import { BackendRoute, DtoShape, HttpMethod } from './audit-types';

const ROLES_KEY = 'roles';
const IS_PUBLIC_KEY = 'isPublic';
const IDEMPOTENT_KEY = 'idempotent';

interface UnwrappedModule {
  module: Type<unknown> | null;
  imports: unknown[];
  controllers: Array<Type<unknown>>;
}

interface ModuleLike {
  forwardRef?: () => unknown;
  module?: Type<unknown>;
  imports?: unknown[];
  controllers?: Array<Type<unknown>>;
}

function unwrapModule(entry: unknown): UnwrappedModule {
  if (typeof entry === 'function')
    return { module: entry as Type<unknown>, imports: [], controllers: [] };
  if (!entry || typeof entry !== 'object')
    return { module: null, imports: [], controllers: [] };
  const ref = entry as ModuleLike;
  if (ref.forwardRef) return unwrapModule(ref.forwardRef());
  return {
    module: ref.module ?? null,
    imports: ref.imports ?? [],
    controllers: ref.controllers ?? [],
  };
}

/** Every controller registered under `root`, once. */
export function collectControllers(root: Type<unknown>): Array<Type<unknown>> {
  const seenModules = new Set<unknown>();
  const controllers = new Set<Type<unknown>>();
  const queue: unknown[] = [root];
  while (queue.length) {
    const entry = unwrapModule(queue.shift());
    entry.controllers.forEach((c) => controllers.add(c));
    queue.push(...entry.imports);
    if (!entry.module || seenModules.has(entry.module)) continue;
    seenModules.add(entry.module);
    const declared = (Reflect.getMetadata('controllers', entry.module) ??
      []) as Array<Type<unknown>>;
    declared.forEach((c) => controllers.add(c));
    queue.push(
      ...((Reflect.getMetadata('imports', entry.module) ?? []) as unknown[]),
    );
  }
  return [...controllers];
}

function firstString(raw: unknown): string {
  const first: unknown = Array.isArray(raw) ? raw[0] : raw;
  return typeof first === 'string' ? first : '';
}

function joinPath(...parts: string[]): string {
  const joined = parts
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return `/${joined}`.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

/** Whitelisted (decorated) and required properties of a class-validator DTO. */
export function dtoShape(dto: Type<unknown>): DtoShape {
  const metas = getMetadataStorage().getTargetValidationMetadatas(
    dto,
    '',
    true,
    false,
  );
  const fields = new Set<string>();
  const optional = new Set<string>();
  for (const meta of metas) {
    fields.add(meta.propertyName);
    if (meta.type === 'conditionalValidation') optional.add(meta.propertyName);
  }
  const sorted = [...fields].sort();
  return {
    name: dto.name,
    fields: sorted,
    required: sorted.filter((f) => !optional.has(f)),
  };
}

const PRIMITIVES = new Set<unknown>([
  Object,
  String,
  Number,
  Boolean,
  Array,
  undefined,
]);

interface ArgInfo {
  body: DtoShape | null;
  bodyFieldParams: string[];
  requiresIfMatch: boolean;
}

/** The `@IfMatch()` decorator's custom-argument key prefix (a uuid created by `createParamDecorator`). */
function ifMatchKeyPrefix(ifMatch: () => ParameterDecorator): string {
  class Probe {
    handle(): void {}
  }
  ifMatch()(Probe.prototype, 'handle', 0);
  const meta = (Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'handle') ??
    {}) as Record<string, unknown>;
  return (Object.keys(meta)[0] ?? '').split(':')[0];
}

function argsOf(
  controller: Type<unknown>,
  handler: string,
  ifMatchPrefix: string,
): ArgInfo {
  const meta = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handler) ??
    {}) as Record<string, { index: number; data?: unknown }>;
  const types = (Reflect.getMetadata(
    'design:paramtypes',
    controller.prototype as object,
    handler,
  ) ?? []) as unknown[];
  const info: ArgInfo = {
    body: null,
    bodyFieldParams: [],
    requiresIfMatch: false,
  };
  for (const [key, arg] of Object.entries(meta)) {
    const kind = key.split(':')[0];
    if (ifMatchPrefix && kind === ifMatchPrefix) info.requiresIfMatch = true;
    if (kind !== String(RouteParamtypes.BODY)) continue;
    if (typeof arg.data === 'string') {
      info.bodyFieldParams.push(arg.data);
      continue;
    }
    const type = types[arg.index];
    if (typeof type === 'function' && !PRIMITIVES.has(type))
      info.body = dtoShape(type as Type<unknown>);
  }
  return info;
}

function listTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) listTs(full, out);
    else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

/** `ClassName.handler` → `server/pro-act-backend/src/...:line`, from the controller sources. */
function handlerLocations(
  srcDir: string,
  repoRoot: string,
): Map<string, string> {
  const result = new Map<string, string>();
  const files = listTs(srcDir).filter((f) =>
    readFileSync(f, 'utf8').includes('@Controller('),
  );
  for (const file of files) {
    const rel = relative(repoRoot, file).replace(/\\/g, '/');
    let current = '';
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        const cls = /export class (\w+)/.exec(line);
        if (cls) current = cls[1];
        const method = /^\s+(?:async\s+)?(\w+)\s*\(/.exec(line);
        const key = method ? `${current}.${method[1]}` : '';
        if (method && current && !result.has(key))
          result.set(key, `${rel}:${index + 1}`);
      });
  }
  return result;
}

export interface BackendInventoryInput {
  appModule: Type<unknown>;
  ifMatch: () => ParameterDecorator;
  srcDir: string;
  repoRoot: string;
}

/** Every registered route as `/api/...` (v2 controllers under `/api/v2`). */
export function buildBackendInventory(
  input: BackendInventoryInput,
): BackendRoute[] {
  const locations = handlerLocations(input.srcDir, input.repoRoot);
  const prefix = ifMatchKeyPrefix(input.ifMatch);
  return collectControllers(input.appModule).flatMap((controller) =>
    routesOf(controller, prefix, locations),
  );
}

/** Own and inherited method names (handlers of a base controller class are routes too). */
function handlerNames(controller: Type<unknown>): string[] {
  const names = new Set<string>();
  let proto: object | null = controller.prototype as object;
  while (proto && proto !== Object.prototype) {
    Object.getOwnPropertyNames(proto).forEach((n) => names.add(n));
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return [...names];
}

function routesOf(
  controller: Type<unknown>,
  ifMatchPrefix: string,
  locations: Map<string, string>,
): BackendRoute[] {
  const classPath = firstString(Reflect.getMetadata(PATH_METADATA, controller));
  const version = firstString(
    Reflect.getMetadata(VERSION_METADATA, controller),
  );
  const classRoles = (Reflect.getMetadata(ROLES_KEY, controller) ?? null) as
    | string[]
    | null;
  const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
  const proto = controller.prototype as Record<string, unknown>;
  return handlerNames(controller).flatMap((name): BackendRoute[] => {
    const handler = proto[name];
    if (name === 'constructor' || typeof handler !== 'function') return [];
    const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
      | RequestMethod
      | undefined;
    if (requestMethod === undefined) return [];
    const handlerRoles = (Reflect.getMetadata(ROLES_KEY, handler) ?? null) as
      | string[]
      | null;
    const args = argsOf(controller, name, ifMatchPrefix);
    const route = firstString(Reflect.getMetadata(PATH_METADATA, handler));
    return [
      {
        method: RequestMethod[requestMethod] as HttpMethod,
        path: joinPath('api', version ? `v${version}` : '', classPath, route),
        controller: controller.name,
        handler: name,
        location: locations.get(`${controller.name}.${name}`) ?? '',
        roles: handlerRoles ?? classRoles ?? [],
        isPublic:
          classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
        idempotent: Reflect.getMetadata(IDEMPOTENT_KEY, handler) === true,
        requiresIfMatch: args.requiresIfMatch,
        body: args.body,
        bodyFieldParams: args.bodyFieldParams,
      },
    ];
  });
}
