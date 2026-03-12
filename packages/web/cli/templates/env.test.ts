import { describe, it, expect } from 'vitest'
import { generateEnv } from './env'

const baseOptions = {
  port: 3000,
  includeDb: true,
  dbPassword: 'testpass',
  screenshotsPath: '/screenshots',
  githubClientId: 'gh-client-123',
  githubClientSecret: 'gh-secret-456',
  sessionSecret: 'session-secret-789',
  apiKey: 'api-key-abc',
}

describe('generateEnv', () => {
  it('includes GitHub OAuth credentials', () => {
    const env = generateEnv(baseOptions)
    expect(env).toContain('GITHUB_CLIENT_ID=gh-client-123')
    expect(env).toContain('GITHUB_CLIENT_SECRET=gh-secret-456')
  })

  it('includes session secret', () => {
    const env = generateEnv(baseOptions)
    expect(env).toContain('SESSION_SECRET=session-secret-789')
  })

  it('includes API key', () => {
    const env = generateEnv(baseOptions)
    expect(env).toContain('ARGUS_API_KEY=api-key-abc')
  })

  it('includes DB_PASSWORD when includeDb is true', () => {
    const env = generateEnv(baseOptions)
    expect(env).toContain('DB_PASSWORD=testpass')
    expect(env).not.toContain('DATABASE_URL=')
  })

  it('includes DATABASE_URL when includeDb is false', () => {
    const env = generateEnv({
      ...baseOptions,
      includeDb: false,
      dbConnectionString: 'postgresql://user:pass@host:5432/argus',
    })
    expect(env).toContain('DATABASE_URL=postgresql://user:pass@host:5432/argus')
    expect(env).not.toContain('DB_PASSWORD=')
  })

  it('includes port and screenshots path', () => {
    const env = generateEnv(baseOptions)
    expect(env).toContain('PORT=3000')
    expect(env).toContain('SCREENSHOTS_PATH=/screenshots')
  })
})
