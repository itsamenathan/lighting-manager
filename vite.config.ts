import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Read PORT from .env too, so the proxy follows the API server's port.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    root: "client",
    plugins: [react()],
    build: { outDir: "../dist", emptyOutDir: true },
    server: {
      port: 5173,
      proxy: { "/api": { target: `http://localhost:${env.PORT ?? 4000}` } },
    },
  };
});
