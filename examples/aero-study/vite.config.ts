import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: vite serves the frontend on 4182 and proxies API calls to the Node
// server (`npm start`, port 4181). Production: the Node server serves dist/.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4182,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:4181' },
  },
})
