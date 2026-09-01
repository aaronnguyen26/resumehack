import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runBuild() {
  console.log('[ResumeHack Build] 1/2 Building Side Panel and Background Service Worker...');
  await build({
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      modulePreload: false,
      rollupOptions: {
        input: {
          sidepanel: resolve(__dirname, 'index.html'),
          background: resolve(__dirname, 'src/background/service-worker.ts'),
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'background') return 'background.js';
            return 'assets/[name]-[hash].js';
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
  });

  const contentScripts = [
    { name: 'content_scraper', entry: 'src/content-scripts/job-scraper.ts' },
    { name: 'content_docs', entry: 'src/content-scripts/docs-helper.ts' },
    { name: 'content_autofill', entry: 'src/content-scripts/autofill.ts' },
    { name: 'content_mascot', entry: 'src/content-scripts/mascot.ts' },
  ];

  console.log('[ResumeHack Build] 2/2 Building standalone IIFE content scripts (zero ES imports)...');
  for (const cs of contentScripts) {
    await build({
      configFile: false,
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        modulePreload: false,
        lib: {
          entry: resolve(__dirname, cs.entry),
          name: cs.name,
          formats: ['iife'],
          fileName: () => `content-scripts/${cs.name}.js`,
        },
        rollupOptions: {
          output: {
            extend: true,
            inlineDynamicImports: true,
          },
        },
      },
    });
  }

  console.log('[ResumeHack Build] ✨ Extension bundle built successfully!');
}

runBuild().catch((err) => {
  console.error('[ResumeHack Build] ❌ Build failed:', err);
  process.exit(1);
});
