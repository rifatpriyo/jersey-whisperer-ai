import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter((dep) => !dep.includes("supabase-vendor"));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            /node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/.test(id) ||
            id.includes("@tanstack/react-router") ||
            id.includes("@tanstack/react-query")
          ) {
            return "react-vendor";
          }
          if (id.includes("@supabase")) return "supabase-vendor";
          if (
            id.includes("lucide-react") ||
            id.includes("@radix-ui") ||
            id.includes("cmdk") ||
            id.includes("vaul") ||
            id.includes("class-variance-authority") ||
            id.includes("tailwind-merge")
          ) {
            return "ui-vendor";
          }
          return undefined;
        },
      },
    },
  },
});
