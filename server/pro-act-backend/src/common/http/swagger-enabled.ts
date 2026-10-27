/**
 * Whether the API reference (Swagger UI at /api and /api/docs/v2) is served. `FORGE_SWAGGER=true|false`
 * decides; unset, it is on outside production and off in production (the UI needs no sign-in).
 */
export function swaggerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.FORGE_SWAGGER?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return env.NODE_ENV !== 'production';
}
