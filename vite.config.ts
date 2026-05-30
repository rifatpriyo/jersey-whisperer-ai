import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            /node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/.test(id) ||
            id.includes("@tanstack/react-router") ||
            id.includes("@tanstack/react-query")
          ) {
            return "vendor-react";
          }
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (
            id.includes("@radix-ui") ||
            id.includes("cmdk") ||
            id.includes("vaul") ||
            id.includes("class-variance-authority") ||
            id.includes("tailwind-merge")
          ) {
            return "vendor-ui";
          }
          return undefined;
        },
      },
    },
  },
});
