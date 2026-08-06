import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "static",
  publicDir: "../public",
  base: "./",
  plugins: [react()],
  build: { emptyOutDir: true, outDir: "../dist" },
});
