/** Release identity baked into the image (`APP_VERSION`, `GIT_COMMIT` build args, TF-PREP-001 §4.4). */
export interface BuildInfo {
  version: string;
  commit: string;
}

export function buildInfo(env: NodeJS.ProcessEnv = process.env): BuildInfo {
  return {
    version: env.APP_VERSION || 'dev',
    commit: env.GIT_COMMIT || 'unknown',
  };
}
