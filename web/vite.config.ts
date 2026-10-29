import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production: `npm run build` writes dist/, which the Go API serves on :8090.
// Development: `npm run dev` serves on :5173 and forwards /api to the API on :8090.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8090", "/healthz": "http://localhost:8090" },
  },
  build: { outDir: "dist", sourcemap: true },
});
