/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base baked into the build ("/api" behind the same-origin proxy); see services/api/apiBaseUrl.ts */
  readonly VITE_API_BASE_URL?: string;
  /** dev-server proxy target for the PI Web API (vite.config.ts only) */
  readonly VITE_PI_SERVER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
