import { execaCommand } from 'execa'

/**
 * Get current git branch
 */
export async function getCurrentBranch(): Promise<string> {
  try {
    const { stdout } = await execaCommand('git rev-parse --abbrev-ref HEAD')
    return stdout.trim()
  } catch (error) {
    throw new Error('Failed to get current branch. Is this a git repository?')
  }
}

/**
 * Get current commit hash
 */
export async function getCurrentCommitHash(): Promise<string> {
  try {
    const { stdout } = await execaCommand('git rev-parse HEAD')
    return stdout.trim()
  } catch (error) {
    throw new Error('Failed to get commit hash')
  }
}

/**
 * Get commit message
 */
export async function getCommitMessage(hash?: string): Promise<string> {
  try {
    const cmd = hash ? `git log -1 --pretty=%B ${hash}` : 'git log -1 --pretty=%B'
    const { stdout } = await execaCommand(cmd)
    return stdout.trim()
  } catch (error) {
    return ''
  }
}

/**
 * Check if working directory is clean
 */
export async function isWorkingDirectoryClean(): Promise<boolean> {
  try {
    const { stdout } = await execaCommand('git status --porcelain')
    return stdout.trim() === ''
  } catch (error) {
    return false
  }
}

/**
 * Get changed files between branches
 */
export async function getChangedFiles(baseBranch: string, currentBranch: string): Promise<string[]> {
  try {
    const { stdout } = await execaCommand(`git diff ${baseBranch}...${currentBranch} --name-only`)
    return stdout.split('\n').filter(Boolean)
  } catch (error) {
    return []
  }
}
