import { describe, it, expect } from 'vitest'
import { generateDockerCompose } from './docker-compose'

const baseOptions = {
  port: 3000,
  includeDb: true,
  dbPassword: 'argus',
  includeNginx: false,
  https: 'none' as const,
  screenshotsPath: '/screenshots',
}

describe('generateDockerCompose', () => {
  it('includes auth env vars in web service', () => {
    const compose = generateDockerCompose(baseOptions)
    expect(compose).toContain('GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}')
    expect(compose).toContain('GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}')
    expect(compose).toContain('SESSION_SECRET=${SESSION_SECRET}')
    expect(compose).toContain('ARGUS_API_KEY=${ARGUS_API_KEY}')
  })

  it('includes DATABASE_URL when includeDb is true', () => {
    const compose = generateDockerCompose(baseOptions)
    expect(compose).toContain('DATABASE_URL=postgresql://argus:${DB_PASSWORD:-argus}@db:5432/argus')
  })

  it('includes external DATABASE_URL when includeDb is false', () => {
    const compose = generateDockerCompose({
      ...baseOptions,
      includeDb: false,
    })
    expect(compose).toContain('DATABASE_URL=${DATABASE_URL}')
    expect(compose).not.toContain('service_healthy')
  })

  it('exposes port directly without nginx', () => {
    const compose = generateDockerCompose(baseOptions)
    expect(compose).toContain('ports:')
    expect(compose).toContain('3000')
    expect(compose).not.toContain('nginx')
  })

  it('uses internal expose with nginx', () => {
    const compose = generateDockerCompose({
      ...baseOptions,
      includeNginx: true,
      domain: 'argus.example.com',
    })
    expect(compose).toContain('expose:')
    expect(compose).toContain('"3000"')
    expect(compose).toContain('nginx')
  })
})
