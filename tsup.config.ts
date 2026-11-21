import { defineConfig } from 'tsup'

// Two entries: the framework-free core, and the React bindings. The React
// file is a client module for Next.js (the App Router reads the directive).
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    target: 'es2019',
    sourcemap: true,
  },
  {
    entry: { react: 'src/react.tsx' },
    format: ['esm', 'cjs'],
    dts: true,
    target: 'es2019',
    sourcemap: true,
    external: ['react'],
    banner: { js: "'use client';" },
  },
])
