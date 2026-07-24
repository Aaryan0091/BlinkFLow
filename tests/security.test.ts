import { describe, expect, it } from 'vitest'
import {
  buildContentSecurityPolicy,
  createRendererUrlValidator,
} from '../electron/security.js'

describe('Electron renderer security', () => {
  it('accepts the configured development renderer and rejects lookalike origins', () => {
    const isTrusted = createRendererUrlValidator({
      isDev: true,
      devServerUrl: 'http://localhost:5173/',
      rendererFileUrl: 'file:///Applications/Eye%20Break/dist/index.html',
    })

    expect(isTrusted('http://localhost:5173/?mode=break')).toBe(true)
    expect(isTrusted('http://localhost:5173/admin')).toBe(false)
    expect(isTrusted('http://localhost:5173.attacker.example/')).toBe(false)
    expect(isTrusted('https://localhost:5173/')).toBe(false)
  })

  it('allows only the packaged renderer file in production', () => {
    const isTrusted = createRendererUrlValidator({
      isDev: false,
      devServerUrl: 'http://localhost:5173/',
      rendererFileUrl: 'file:///Applications/Eye%20Break/dist/index.html',
    })

    expect(
      isTrusted('file:///Applications/Eye%20Break/dist/index.html?mode=break'),
    ).toBe(true)
    expect(
      isTrusted('file:///Applications/Eye%20Break/dist/another.html'),
    ).toBe(false)
    expect(isTrusted('https://example.com/')).toBe(false)
  })

  it('uses a restrictive production Content Security Policy', () => {
    const policy = buildContentSecurityPolicy(false)

    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("script-src 'self'")
    expect(policy).toContain("font-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).not.toContain("'unsafe-eval'")
    expect(policy).not.toContain('https:')
  })
})
