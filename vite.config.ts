import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist/client",
    emptyOutDir: false
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**"]
  }
});
