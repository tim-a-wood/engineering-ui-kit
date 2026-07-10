import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: vite on 4184 proxies API calls to the Node server (`npm start`, 4180).
// Production: the Node server serves dist/.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4184,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:4180' },
  },
})
