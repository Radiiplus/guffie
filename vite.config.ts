import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url"; // Import this helper

// Convert import.meta.url to a file path equivalent to __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Now this will work correctly in ESM
      "@": path.resolve(__dirname, "./src"),
      "graphql-ws": path.resolve(__dirname, "./node_modules/graphql-ws/dist/client.js"),
    },
  },
});
