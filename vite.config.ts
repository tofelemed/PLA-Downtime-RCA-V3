import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";
import { prodBundleGuard } from "./scripts/vite-prod-bundle-guard";

/**
 * Long-lived vendor chunks (docs/UI_UX_AUDIT.md §5): libraries change less often than app code, so
 * splitting them keeps them cached across deploys. Heavy libraries used by few pages (charts, flow
 * diagrams, timelines, drag and drop) get their own chunks and are only fetched by those pages.
 */
const VENDOR_CHUNKS: ReadonlyArray<[chunk: string, packages: RegExp]> = [
  // tiny helpers shared by the shell and the heavy libraries: without their own chunk Rollup hoists them
  // into a heavy chunk (e.g. clsx into charts), which then loads on every page
  ["shared", /\/node_modules\/(clsx|tailwind-merge|class-variance-authority|tslib|@babel\/runtime|react-is|prop-types|object-assign)\//],
  ["react-vendor", /\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run)\//],
  ["query", /\/node_modules\/@tanstack\/(react-query|query-core)\//],
  ["socket", /\/node_modules\/(socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser|@socket\.io)\//],
  // module ids are "/"-separated on every OS; flow first: reactflow's d3 modules belong with it
  ["flow", /\/node_modules\/(reactflow|@reactflow|d3-zoom|d3-drag|d3-selection|d3-dispatch|d3-transition|zustand)\//],
  ["charts", /\/node_modules\/(recharts|recharts-scale|victory-vendor|d3-[a-z-]+|internmap)\//],
  ["timeline", /\/node_modules\/react-chrono\//],
  ["dnd", /\/node_modules\/(@dnd-kit|@react-spring)\//],
];

function manualChunks(id: string): string | undefined {
  return VENDOR_CHUNKS.find(([, pattern]) => pattern.test(id))?.[0];
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8070,
    proxy: {
      // Dev proxy for AVEVA PI Web API. Do NOT commit secrets.
      // All client requests to `/piwebapi` will be forwarded to the remote PI server.
      // UPDATE: Now supports multiple PI servers via environment variable
      "/piwebapi": {
        target: process.env.VITE_PI_SERVER || "https://87.107.103.198:7443",
        changeOrigin: true,
        secure: false,
        // Preserve path so `/piwebapi/...` is kept
        rewrite: (path) => path,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    mode !== 'development' && prodBundleGuard(),
    // `npm run build:analyze`: treemap of every chunk with gzip/brotli sizes
    mode === 'analyze' &&
      (visualizer({ filename: "dist/bundle-report.html", gzipSize: true, brotliSize: true, template: "treemap" }) as PluginOption),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
