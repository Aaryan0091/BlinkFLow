export type RendererUrlValidatorOptions = {
  isDev: boolean
  devServerUrl: string
  rendererFileUrl: string
}

function normalizedOrigin(candidate: URL) {
  return `${candidate.protocol}//${candidate.host}`
}

export function createRendererUrlValidator({
  isDev,
  devServerUrl,
  rendererFileUrl,
}: RendererUrlValidatorOptions) {
  const trustedUrl = new URL(isDev ? devServerUrl : rendererFileUrl)

  return (candidateUrl: string) => {
    try {
      const candidate = new URL(candidateUrl)

      if (isDev) {
        return (
          normalizedOrigin(candidate) === normalizedOrigin(trustedUrl) &&
          candidate.pathname === trustedUrl.pathname
        )
      }

      return (
        candidate.protocol === 'file:' &&
        candidate.hostname === trustedUrl.hostname &&
        candidate.pathname === trustedUrl.pathname
      )
    } catch {
      return false
    }
  }
}

export function buildContentSecurityPolicy(isDev: boolean) {
  const scriptSource = isDev ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'"
  const connectSource = isDev
    ? "connect-src 'self' ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:*"
    : "connect-src 'self'"

  return [
    "default-src 'self'",
    scriptSource,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    connectSource,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join('; ')
}
