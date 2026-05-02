import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:4000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/v1": { target, changeOrigin: true },
        "/key": { target, changeOrigin: true },
        "/user": { target, changeOrigin: true },
        "/team": { target, changeOrigin: true },
        "/global": { target, changeOrigin: true },
        "/customer": { target, changeOrigin: true },
        "/organization": { target, changeOrigin: true },
      },
    },
  };
});
