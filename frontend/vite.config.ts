import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    // three.js is intrinsically large and lazy-loaded only on the embeddings route.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // 3D stack — only needed on the embeddings view
          three: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          // Charts & data-viz
          charts: ['d3', 'recharts'],
          // Pipeline graph canvas
          flow: ['@xyflow/react'],
          // Core vendor (router, animation, state)
          vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8090',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
