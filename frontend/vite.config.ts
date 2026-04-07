import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.ANCHOR_BROWSER": "true",
    global: "globalThis",
  },
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
