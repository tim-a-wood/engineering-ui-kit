import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "static",
  publicDir: "../public",
  base: process.env.GITHUB_PAGES_BASE ?? "/engineering-ui-kit/mockups/kinetic-forge/",
  plugins: [react()],
  build: { emptyOutDir: true, outDir: "../pages-dist" },
});
