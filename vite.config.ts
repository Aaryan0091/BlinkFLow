import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        onstart({ startup }) {
          void startup(['.'])
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rolldownOptions: {
              output: {
                entryFileNames: 'preload.cjs',
                chunkFileNames: '[name].cjs',
              },
            },
          },
        },
      },
    }),
    renderer(),
  ],
})
