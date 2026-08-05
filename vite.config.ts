import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Pin the port so the bookmarked URL keeps working, and fail loudly if it is taken rather
    // than silently moving to another port. Binding both stacks avoids the case where the browser
    // resolves localhost to 127.0.0.1 while Vite is only listening on ::1.
    port: 5177,
    strictPort: true,
    host: true,
  },
  // So a hard refresh on /tagger still serves the SPA instead of a 404.
  preview: {
    port: 5177,
    strictPort: true,
  },
  appType: 'spa',
})
