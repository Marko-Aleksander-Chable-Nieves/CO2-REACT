import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/CO2-REACT/',  // 👈 importante: el nombre EXACTO del repo
})

