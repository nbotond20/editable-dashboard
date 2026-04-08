/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

function getVersionInfo() {
  const tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim()
  const version = tag.replace(/^v/, '')
  const commitsSince = Number(execSync(`git rev-list ${tag}..HEAD --count`, { encoding: 'utf-8' }).trim())
  const shortHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  return { version, commitsSince, shortHash }
}

const versionInfo = getVersionInfo()

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(versionInfo.version),
    __COMMITS_SINCE_RELEASE__: JSON.stringify(versionInfo.commitsSince),
    __GIT_SHORT_HASH__: JSON.stringify(versionInfo.shortHash),
  },
  build: {
    outDir: 'dist/app',
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
