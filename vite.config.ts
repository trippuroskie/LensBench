import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        // Bound to localhost on purpose: the bundle this server hands out has
        // OPENROUTER_API_KEY inlined (see `define` below), so exposing it on
        // 0.0.0.0 would hand the key to anyone on the same network.
        // Need LAN access anyway? Run: npm run dev -- --host
        host: 'localhost',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.OPENROUTER_API_KEY),
        'process.env.OPENROUTER_API_KEY': JSON.stringify(env.OPENROUTER_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
