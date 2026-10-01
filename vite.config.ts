import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The whole prototype ships as one screen; one ~740 kB chunk (180 kB gzipped) is expected.
  build: { chunkSizeWarningLimit: 1000 },
});
