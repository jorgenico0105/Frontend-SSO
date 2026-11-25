import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El panel se publica en https://DOMINIO/panel/ (Caddy, ver ../../deploy/Caddyfile) junto a la API.
// En desarrollo, /api y las páginas legales van al Nest local (npm run start:dev en ../../backend).
const API = process.env.VITE_PROXY_API ?? 'http://localhost:3000'

export default defineConfig({
  base: '/panel/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: Object.fromEntries(['/api', '/terminos', '/privacidad'].map((p) => [p, API])),
  },
})
