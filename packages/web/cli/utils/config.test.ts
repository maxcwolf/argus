import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { findArgusDir, DEFAULT_DIR, DOCKER_IMAGE, DEFAULT_PORT, DEFAULT_DB_PASSWORD, DEFAULT_SCREENSHOTS_PATH } from './config'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

const mockedExistsSync = vi.mocked(existsSync)

describe('findArgusDir', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns resolved path when docker-compose.yml exists', () => {
    mockedExistsSync.mockReturnValue(true)
    const result = findArgusDir('/some/path')
    expect(result).toBe(resolve('/some/path'))
    expect(mockedExistsSync).toHaveBeenCalledWith(resolve('/some/path', 'docker-compose.yml'))
  })

  it('uses default dir when no arg provided', () => {
    mockedExistsSync.mockReturnValue(true)
    const result = findArgusDir()
    expect(result).toBe(resolve(process.cwd(), DEFAULT_DIR))
  })

  it('exits with code 1 when docker-compose.yml is missing', () => {
    mockedExistsSync.mockReturnValue(false)
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    findArgusDir('/nonexistent')

    expect(mockExit).toHaveBeenCalledWith(1)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No docker-compose.yml found'))
    mockExit.mockRestore()
  })
})

describe('config constants', () => {
  it('exports expected defaults', () => {
    expect(DOCKER_IMAGE).toBe('ghcr.io/maxcwolf/argus-web')
    expect(DEFAULT_DIR).toBe('./argus')
    expect(DEFAULT_PORT).toBe(3000)
    expect(DEFAULT_DB_PASSWORD).toBe('argus')
    expect(DEFAULT_SCREENSHOTS_PATH).toBe('./argus-data/images')
  })
})
