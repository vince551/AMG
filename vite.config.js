import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset URLs keep the build working from the site root on Vercel and
  // Firebase Hosting as well as from a sub-folder such as http://localhost/AMG/dist/.
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep the long-lived third-party libraries in their own cacheable chunks.
        manualChunks: {
          firebase: [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
            "firebase/storage",
            "firebase/functions"
          ],u8``
          libraries: ["html2canvas", "jsbarcode", "qrcode"]
        }
      }
    }
  },
  server: {
    port: 5173,
    // Apache serves the Laravel API at /AMG/api. Proxying it through the dev
    // server keeps development same-origin, so Sanctum's cookie session and
    // CSRF token work exactly as they do in production.
    proxy: {
      "/api": {
        target: "http://localhost",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, "/AMG/api")
      }
    }
  }
});
