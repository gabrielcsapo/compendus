import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { defineConfig } from "vite";
import { resolve } from "path";
import { reactRouter } from "./react-router-vite/plugin.js";

export default defineConfig({
  clearScreen: false,
  build: {
    minify: false,
  },
  plugins: [
    tailwindcss(),
    react(),
    reactRouter(),
    rsc({
      entries: {
        client: "./react-router-vite/entry.browser.tsx",
        ssr: "./react-router-vite/entry.ssr.tsx",
        rsc: "./react-router-vite/entry.rsc.single.tsx",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./app"),
    },
  },
  optimizeDeps: {
    include: ["react-router", "react-router/internal/react-server-client"],
    exclude: ["better-sqlite3"],
  },
  preview: {
    // Allow connections from iOS simulator and local network devices
    host: true,
    port: 3000,
    // Allow requests from reverse proxy with different origin
    allowedHosts: ["*"],
  },
  server: {
    // Allow connections from iOS simulator and local network devices
    host: true,
    port: 3000,
    // Serve static files from data directory
    fs: {
      allow: ["..", "./data"],
    },
    // Allow requests from reverse proxy with different origin
    allowedHosts: ["*"],
  },
  // Public directory for static assets
  publicDir: "public",
}) as any;
