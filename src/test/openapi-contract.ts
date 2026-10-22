import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The part of a JSON schema (OpenAPI 3) the request contract check reads. */
interface JsonSchema {
  $ref?: string;
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  allOf?: JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
}

type CommandMethod = 'post' | 'put' | 'patch';

interface Parameter {
  name: string;
  in: string;
}

interface Operation {
  requestBody?: { content?: Record<string, { schema?: JsonSchema }> };
  parameters?: Parameter[];
}

interface OpenApiDocument {
  paths: Record<string, Partial<Record<CommandMethod | 'get', Operation>>>;
  components: { schemas: Record<string, JsonSchema> };
}

/** The public v2 contract the backend snapshot test keeps in step with its DTOs. */
const SPEC_PATH = resolve(process.cwd(), 'server/pro-act-backend/openapi/v2.json');
let cached: OpenApiDocument | null = null;

function openApi(): OpenApiDocument {
  cached ??= JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as OpenApiDocument;
  return cached;
}

function resolveSchema(schema: JsonSchema | undefined): JsonSchema | null {
  if (!schema) return null;
  if (schema.$ref) return resolveSchema(openApi().components.schemas[schema.$ref.replace('#/components/schemas/', '')]);
  if (!schema.allOf) return schema;
  const parts = schema.allOf.map(resolveSchema).filter((part): part is JsonSchema => part !== null);
  return {
    type: 'object',
    properties: Object.assign({}, ...parts.map((part) => part.properties ?? {})),
    required: parts.flatMap((part) => part.required ?? []),
  };
}

function requestSchema(route: string, method: CommandMethod): JsonSchema {
  const operation = openApi().paths[route]?.[method];
  if (!operation) throw new Error(`${method.toUpperCase()} ${route} is not in openapi/v2.json`);
  const schema = resolveSchema(operation.requestBody?.content?.['application/json']?.schema);
  if (!schema) throw new Error(`${method.toUpperCase()} ${route} declares no JSON body`);
  return schema;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function walk(schema: JsonSchema | undefined, value: unknown, path: string, problems: string[]): void {
  const resolved = resolveSchema(schema);
  if (!resolved) return;
  if (Array.isArray(value)) value.forEach((item, index) => walk(resolved.items, item, `${path}[${index}]`, problems));
  else if (isRecord(value)) walkObject(resolved, value, path, problems);
}

function walkObject(resolved: JsonSchema, value: Record<string, unknown>, path: string, problems: string[]): void {
  if (!resolved.properties || resolved.additionalProperties) return;
  for (const [key, member] of Object.entries(value)) {
    const declared = resolved.properties[key];
    if (declared) walk(declared, member, `${path}.${key}`, problems);
    else problems.push(`${path}.${key} is not declared (the server answers "property ${key} should not exist")`);
  }
  for (const key of resolved.required ?? []) {
    if (value[key] === undefined) problems.push(`${path}.${key} is required`);
  }
}

/**
 * What the global ValidationPipe (`whitelist` + `forbidNonWhitelisted`) would refuse in this body by shape:
 * undeclared properties at any depth and missing required ones. The body goes through JSON first, as on
 * the wire (undefined members disappear). Empty = the payload matches the request schema.
 */
export function contractProblems(route: string, method: CommandMethod, body: unknown): string[] {
  const problems: string[] = [];
  walk(requestSchema(route, method), JSON.parse(JSON.stringify(body)) as unknown, 'body', problems);
  return problems;
}

/**
 * What the ValidationPipe would refuse in a list query by name: query parameters the GET operation does not
 * declare (`forbidNonWhitelisted` answers 400/422). Blank values are left out, as `buildUrl` does on the wire.
 */
export function queryProblems(route: string, query: Record<string, unknown>): string[] {
  const operation = openApi().paths[route]?.get;
  if (!operation) throw new Error(`GET ${route} is not in openapi/v2.json`);
  const declared = new Set((operation.parameters ?? []).filter((p) => p.in === 'query').map((p) => p.name));
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .filter(([name]) => !declared.has(name))
    .map(([name]) => `query.${name} is not declared (the server answers "property ${name} should not exist")`);
}
