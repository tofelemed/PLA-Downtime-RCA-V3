import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
