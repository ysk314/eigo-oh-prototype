import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
const rawBase = process.env.VITE_BASE_URL ?? '/eigo-oh-2/'
const normalizedBase = rawBase.startsWith('/') ? rawBase : `/${rawBase}`
const base = normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`

export default defineConfig({
    base,
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
