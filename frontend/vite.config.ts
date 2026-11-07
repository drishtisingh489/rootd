import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The browser only ever talks to Vite; Vite forwards /api to the FastAPI backend. This keeps API calls
// same-origin on localhost, on the LAN IP and through an HTTPS tunnel alike.
const apiProxy = { '/api': 'http://127.0.0.1:8000' }

// HTTPS tunnel hostnames for testing the live camera on a phone (`npm run dev:phone` / scripts/phone.sh).
// LAN IP addresses and localhost are always allowed by Vite.
const tunnelHosts = ['.trycloudflare.com']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Read the single repo-root .env shared with the backend. Only VITE_* variables reach the browser bundle.
  envDir: '..',
  server: {
    port: 5173,
    // The app imports ../shared/preferences.json and ../assets/rootd-logo.png from the repo root.
    fs: { allow: ['..'] },
    proxy: apiProxy,
    allowedHosts: tunnelHosts,
  },
  preview: {
    proxy: apiProxy,
    allowedHosts: tunnelHosts,
  },
})
