import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    ...(mode === 'web'
      ? []
      : [
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
        ]),
  ],
}))
