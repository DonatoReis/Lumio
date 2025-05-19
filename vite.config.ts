import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    //https: {
    //  key: fs.readFileSync(path.resolve(__dirname, 'certs/localhost-key.pem')),
    //  cert: fs.readFileSync(path.resolve(__dirname, 'certs/localhost.pem')),
    //},
    proxy: {
      // Proxy requests to Supabase Edge Functions to bypass CORS
      '/functions/v1/reset-password': {
        target: 'https://cdsiyppfnffuksddfqhd.supabase.co',
        changeOrigin: true,
        secure: true,
        headers: {
          'Origin': 'http://192.168.0.88:8080'
        }
      }
    },
    allowedHosts: [
      'b4ac-2804-8854-106-4800-5016-329a-6fbc-cb7.ngrok-free.app'
    ]
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
