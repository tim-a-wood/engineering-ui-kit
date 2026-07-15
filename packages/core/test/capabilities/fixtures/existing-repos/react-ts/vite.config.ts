import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Minimal, realistic Vite config for the existing-repo migration fixture.
export default defineConfig({
  plugins: [react()],
})
