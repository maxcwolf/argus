import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock execa before importing the module
vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'
import { isDockerInstalled, isDockerRunning, dockerCompose, ensureDocker } from './docker'

const mockedExeca = vi.mocked(execa)

describe('isDockerInstalled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when docker --version succeeds', async () => {
    mockedExeca.mockResolvedValueOnce({} as any)
    expect(await isDockerInstalled()).toBe(true)
    expect(mockedExeca).toHaveBeenCalledWith('docker', ['--version'])
  })

  it('returns false when docker --version fails', async () => {
    mockedExeca.mockRejectedValueOnce(new Error('not found'))
    expect(await isDockerInstalled()).toBe(false)
  })
})

describe('isDockerRunning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when docker info succeeds', async () => {
    mockedExeca.mockResolvedValueOnce({} as any)
    expect(await isDockerRunning()).toBe(true)
    expect(mockedExeca).toHaveBeenCalledWith('docker', ['info'], { stdio: 'ignore' })
  })

  it('returns false when docker info fails', async () => {
    mockedExeca.mockRejectedValueOnce(new Error('daemon not running'))
    expect(await isDockerRunning()).toBe(false)
  })
})

describe('dockerCompose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls docker compose with correct args and cwd', async () => {
    mockedExeca.mockResolvedValueOnce({} as any)
    await dockerCompose(['up', '-d'], '/app/argus')
    expect(mockedExeca).toHaveBeenCalledWith('docker', ['compose', 'up', '-d'], {
      cwd: '/app/argus',
      stdio: 'inherit',
    })
  })

  it('merges additional execa options', async () => {
    mockedExeca.mockResolvedValueOnce({} as any)
    await dockerCompose(['logs'], '/app', { stdio: 'pipe' } as any)
    expect(mockedExeca).toHaveBeenCalledWith('docker', ['compose', 'logs'], {
      cwd: '/app',
      stdio: 'pipe',
    })
  })

  it('exits process on failure', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedExeca.mockRejectedValueOnce(Object.assign(new Error('fail'), { exitCode: 2 }))

    await dockerCompose(['up'], '/app')

    expect(mockExit).toHaveBeenCalledWith(2)
    mockExit.mockRestore()
  })
})

describe('ensureDocker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not exit when docker is installed and running', async () => {
    // First call: isDockerInstalled (docker --version)
    // Second call: isDockerRunning (docker info)
    mockedExeca.mockResolvedValueOnce({} as any).mockResolvedValueOnce({} as any)
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    await ensureDocker()

    expect(mockExit).not.toHaveBeenCalled()
    mockExit.mockRestore()
  })

  it('exits when docker is not installed', async () => {
    mockedExeca.mockRejectedValueOnce(new Error('not found'))
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await ensureDocker()

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  it('exits when docker is not running', async () => {
    // docker --version succeeds, docker info fails
    mockedExeca.mockResolvedValueOnce({} as any).mockRejectedValueOnce(new Error('not running'))
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await ensureDocker()

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })
})
