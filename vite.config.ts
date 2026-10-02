import {
  defineConfig,
  type Plugin,
  type PreviewServer,
  type ViteDevServer,
} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Only the worker's trusted loader compiles Wasm. Guest JS has no browser bridge.
const practiceWorkerPolicy =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; object-src 'none'; base-uri 'none'";
function practiceWorkerHeaders(): Plugin {
  const configure = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((request, response, next) => {
      if (
        request.url?.startsWith("/src/workers/local-practice.worker.ts") ||
        /^\/practice-worker\/local-practice\.worker-[^/]+\.js(?:\?|$)/.test(
          request.url ?? "",
        )
      )
        response.setHeader("Content-Security-Policy", practiceWorkerPolicy);
      next();
    });
  };
  return {
    name: "local-practice-worker-policy",
    configureServer: configure,
    configurePreviewServer: configure,
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), practiceWorkerHeaders()],
  optimizeDeps: {
    include: [
      "typescript",
      "quickjs-emscripten-core",
      "@jitl/quickjs-singlefile-browser-release-sync",
    ],
  },
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "local-practice.worker"
            ? "practice-worker/[name]-[hash].js"
            : "assets/[name]-[hash].js",
      },
    },
  },
  build: { sourcemap: false, chunkSizeWarningLimit: 650 },
});
