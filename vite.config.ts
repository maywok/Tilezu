/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { splitVendorChunkPlugin } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), splitVendorChunkPlugin()],
  build: {
    // Keep chunking conservative: this plugin performs stable vendor splits
    // without the fragile hand-authored manualChunks map.
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
