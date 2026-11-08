import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
  optimizeDeps: {
    // Pre-bundling all of Babylon often breaks in dev; load it directly instead.
    exclude: ["@babylonjs/core"],
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
