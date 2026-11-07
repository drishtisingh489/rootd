import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Read the single repo-root .env shared with the backend. Only VITE_* variables reach the browser bundle.
  envDir: '..',
  server: {
    port: 5173,
    // The app imports ../shared/preferences.json and ../assets/rootd-logo.png from the repo root.
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
