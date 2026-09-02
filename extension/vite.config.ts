import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // Disable modulepreload injection — Chrome extension pages can't use
    // cross-world <link rel="modulepreload"> tags (causes console warnings)
    modulePreload: false,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'index.html'),
        offscreen: resolve(__dirname, 'offscreen.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content_scraper: resolve(__dirname, 'src/content-scripts/job-scraper.ts'),
        content_docs: resolve(__dirname, 'src/content-scripts/docs-helper.ts'),
        content_autofill: resolve(__dirname, 'src/content-scripts/autofill.ts'),
        content_mascot: resolve(__dirname, 'src/content-scripts/mascot.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name.startsWith('content_')) return 'content-scripts/[name].js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Force all shared modules into the sidepanel bundle.
        // When a module is shared between sidepanel and background, Rollup normally
        // extracts it into its own async chunk and injects a <link rel="modulepreload">
        // into index.html — but Chrome extensions reject cross-world preloads.
        // Returning null lets Rollup decide; service-worker modules stay separate.
        manualChunks(id) {
          // Keep src/services/* that's shared between background + sidepanel
          // inside the sidepanel bundle (no separate chunk)
          if (id.includes('/src/services/github-tracker') ||
              id.includes('/src/services/gdocs-api-extractor') ||
              id.includes('/src/services/')) {
            return 'sidepanel';
          }
          // React & vendor deps → vendor chunk (stays preload-free because
          // modulePreload: false removes the <link> tags entirely)
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  }
});

