import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// GitHub Pages alt dizinde yayınlanır: https://<kullanıcı>.github.io/dekorasyon-defteri/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/dekorasyon-defteri/' : '/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
