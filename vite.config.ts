import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  optimizeDeps: {
    // Pre-bundling all of Babylon often breaks in dev; load it directly instead.
    exclude: ["@babylonjs/core"],
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
