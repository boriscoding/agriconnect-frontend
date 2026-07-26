// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  // ... tes autres configurations (plugins, etc.)
  server: {
    allowedHosts: [
      'unsacked-improvisationally-suanne.ngrok-free.dev'
    ]
  }
});