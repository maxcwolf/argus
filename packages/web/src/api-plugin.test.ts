import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'http'
import type { ViteDevServer } from 'vite'
import { apiPlugin } from './api-plugin'

// Extract the middleware handler from the plugin
function getMiddleware() {
  const plugin = apiPlugin()
  let middleware: (req: IncomingMessage, res: ServerResponse, next: () => void) => void

  const mockServer = {
    middlewares: {
      use: (fn: typeof middleware) => {
        middleware = fn
      },
    },
  } as unknown as ViteDevServer

  // @ts-expect-error - configureServer exists at runtime
  plugin.configureServer(mockServer)

  return middleware!
}

function createMockReq(options: { url: string; method: string; headers?: Record<string, string> }) {
  const req = {
    url: options.url,
    method: options.method,
    headers: options.headers || {},
    on: vi.fn(),
  } as unknown as IncomingMessage
  return req
}

function createMockRes() {
  const res = {
    statusCode: 200,
    writeHead: vi.fn(),
    setHeader: vi.fn(),
    end: vi.fn(),
    getHeader: vi.fn(),
  } as unknown as ServerResponse
  return res
}

describe('API key protection on /api/upload', () => {
  let middleware: ReturnType<typeof getMiddleware>

  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects requests without API key when ARGUS_API_KEY is set', async () => {
    vi.stubEnv('ARGUS_API_KEY', 'test-api-key-123')
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test')
    middleware = getMiddleware()

    const req = createMockReq({ url: '/api/upload', method: 'POST' })
    const res = createMockRes()
    const next = vi.fn()

    await middleware(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.end).toHaveBeenCalledWith(
      expect.stringContaining('Unauthorized')
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects requests with wrong API key', async () => {
    vi.stubEnv('ARGUS_API_KEY', 'test-api-key-123')
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test')
    middleware = getMiddleware()

    const req = createMockReq({
      url: '/api/upload',
      method: 'POST',
      headers: { authorization: 'Bearer wrong-key' },
    })
    const res = createMockRes()
    const next = vi.fn()

    await middleware(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('allows requests with correct API key', async () => {
    vi.stubEnv('ARGUS_API_KEY', 'test-api-key-123')
    vi.stubEnv('DATABASE_URL', '')
    middleware = getMiddleware()

    const req = createMockReq({
      url: '/api/upload',
      method: 'POST',
      headers: { authorization: 'Bearer test-api-key-123' },
    })
    const res = createMockRes()
    const next = vi.fn()

    await middleware(req, res, next)

    // Should proceed past API key check (will fail on DB not configured, which is expected)
    expect(res.statusCode).toBe(500)
    expect(res.end).toHaveBeenCalledWith(
      expect.stringContaining('Database not configured')
    )
  })
})

describe('OAuth routes', () => {
  let middleware: ReturnType<typeof getMiddleware>

  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('GET /auth/github returns 500 when GITHUB_CLIENT_ID is not set', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', '')
    middleware = getMiddleware()

    const req = createMockReq({ url: '/auth/github', method: 'GET' })
    const res = createMockRes()
    const next = vi.fn()

    await middleware(req, res, next)

    expect(res.statusCode).toBe(500)
    expect(res.end).toHaveBeenCalledWith('GITHUB_CLIENT_ID not configured')
  })

  it('GET /auth/github redirects to GitHub when configured', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'test-client-id')
    vi.stubEnv('SESSION_SECRET', 'a-very-long-secret-that-is-at-least-32-characters')
    middleware = getMiddleware()

    const req = createMockReq({
      url: '/auth/github',
      method: 'GET',
      headers: { host: 'localhost:3000' },
    })
    const res = createMockRes()
    const next = vi.fn()

    await middleware(req, res, next)

    expect(res.writeHead).toHaveBeenCalledWith(302, {
      Location: expect.stringContaining('github.com/login/oauth/authorize'),
    })
    expect(res.writeHead).toHaveBeenCalledWith(302, {
      Location: expect.stringContaining('client_id=test-client-id'),
    })
  })

  it('GET /auth/github/callback rejects missing code', async () => {
    vi.stubEnv('SESSION_SECRET', 'a-very-long-secret-that-is-at-least-32-characters')
    middleware = getMiddleware()

    const req = createMockReq({
      url: '/auth/github/callback?state=abc',
      method: 'GET',
    })
    const res = createMockRes()
    const next = vi.fn()

    await middleware(req, res, next)

    expect(res.statusCode).toBe(400)
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('state mismatch'))
  })

  it('POST /auth/logout redirects to /auth/github', async () => {
    vi.stubEnv('SESSION_SECRET', 'a-very-long-secret-that-is-at-least-32-characters')
    middleware = getMiddleware()

    const req = createMockReq({ url: '/auth/logout', method: 'POST' })
    const res = createMockRes()
    const next = vi.fn()

    await middleware(req, res, next)

    expect(res.writeHead).toHaveBeenCalledWith(302, { Location: '/auth/github' })
  })

  it('passes through unmatched routes', async () => {
    middleware = getMiddleware()

    const req = createMockReq({ url: '/some/other/route', method: 'GET' })
    const res = createMockRes()
    const next = vi.fn()

    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })
})
