import { describe, expect, it } from 'vitest'
import { decideExclusion, scanContentWarnings } from '../src/exclusions.js'

describe('decideExclusion', () => {
  it('includes ordinary source files', () => {
    expect(decideExclusion('src/App.tsx').excluded).toBe(false)
    expect(decideExclusion('index.html').excluded).toBe(false)
    expect(decideExclusion('package.json').excluded).toBe(false)
  })

  it('excludes git metadata, dependencies, and build output', () => {
    for (const p of ['.git/config', 'node_modules/react/index.js', 'dist/main.js', 'coverage/lcov.info', 'build/out.js']) {
      const decision = decideExclusion(p)
      expect(decision.excluded, p).toBe(true)
      expect(decision.reason).toBeTruthy()
    }
  })

  it('excludes lockfiles and OS metadata', () => {
    expect(decideExclusion('package-lock.json').excluded).toBe(true)
    expect(decideExclusion('.DS_Store').excluded).toBe(true)
  })

  it('excludes env, key, and credential files', () => {
    for (const p of ['.env', '.env.local', 'certs/server.pem', 'ssh/id_rsa', 'aws-credentials.txt']) {
      expect(decideExclusion(p).excluded, p).toBe(true)
    }
  })

  it('excludes binaries and archives by extension', () => {
    for (const p of ['logo.png', 'font.woff2', 'bundle.zip', 'doc.pdf']) {
      expect(decideExclusion(p).excluded, p).toBe(true)
    }
  })

  it('is deterministic', () => {
    const a = decideExclusion('node_modules/x.js')
    const b = decideExclusion('node_modules/x.js')
    expect(a).toEqual(b)
  })
})

describe('scanContentWarnings', () => {
  it('flags private keys and provider tokens', () => {
    expect(scanContentWarnings('a.ts', '-----BEGIN RSA PRIVATE KEY-----').length).toBe(1)
    expect(scanContentWarnings('b.ts', 'const k = "AKIAIOSFODNN7EXAMPLE"').length).toBe(1)
    expect(scanContentWarnings('c.ts', 'token = "ghp_abcdefghijklmnopqrstuv0123456789"').length).toBeGreaterThan(0)
  })

  it('stays quiet on ordinary source', () => {
    expect(scanContentWarnings('d.ts', 'export const semanticTokens = ["surface.canvas"]')).toEqual([])
  })
})
