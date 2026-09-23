import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5190 },
  // Pre-bundle these up front so the dev server never serves a stale optimized copy
  // (the "504 Outdated Optimize Dep" error) after dependencies change.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'qrcode', '@phosphor-icons/react', '@dicebear/core', '@dicebear/notionists'],
  },
});
