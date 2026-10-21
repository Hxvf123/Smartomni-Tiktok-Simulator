/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// In dev the API is proxied and the test-admin token is injected server-side (same as nginx in Docker),
// so the token never ships inside the browser bundle.
const api = process.env.VITE_API_PROXY ?? 'http://localhost:8090';
const adminToken = process.env.TEST_ADMIN_TOKEN ?? '';
const proxy = (extraHeaders: Record<string, string> = {}) => ({ target: api, changeOrigin: true, headers: extraHeaders });

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 3090,
    host: 'localhost',
    proxy: {
      '/demo': proxy(),
      '/health': proxy(),
      '/test-admin': proxy({ 'x-test-admin-token': adminToken }),
    },
  },
  test: { environment: 'jsdom', globals: true, setupFiles: [] },
});
