import { defineConfig } from 'vitest/config'

// Pure editor-model tests do not need the Cloudflare runtime used by the web app.
export default defineConfig({ test: { include: ['src/editor/**/*.test.ts'], environment: 'node' } })
