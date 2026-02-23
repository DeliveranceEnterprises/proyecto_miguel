import { TanStackRouterVite } from "@tanstack/router-vite-plugin"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
  server: {
    port: 5174,
    host: true,
    watch: {
      usePolling: true,
      interval: 100, // Comprueba cambios cada 100ms
    },
    hmr: {
      clientPort: 5174, // Asegura que el cliente busque el HMR en el puerto correcto
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/static": {
        target: process.env.VITE_API_URL || "https://deliverance-api.kindfield-4439a458.westeurope.azurecontainerapps.io/",
        changeOrigin: true,
      }
    },
  },
  publicDir: "public",
})
