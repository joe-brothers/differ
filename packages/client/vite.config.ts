import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8787";

// Proxy API + WS to the local Worker so the browser sees a single origin.
// Required for cookie auth (SameSite=Lax) in development.
const proxyConfig = {
  target: API_TARGET,
  changeOrigin: true,
  ws: true,
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    open: true,
    proxy: {
      "/auth": proxyConfig,
      "/rooms": proxyConfig,
      "/leaderboard": proxyConfig,
      "/health": proxyConfig,
    },
  },
});
