import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    target: 'es2022',
  },
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 8080,
  },
});
