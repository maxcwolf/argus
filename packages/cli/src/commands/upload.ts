import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import ora from 'ora'
import { loadConfig, validateConfig } from '../utils/config'
import { getCurrentBranch, getCurrentCommitHash, getCommitMessage } from '../utils/git'
import { logger } from '../utils/logger'

export interface UploadOptions {
  branch?: string
  apiUrl?: string
}

interface ComparisonResults {
  baseBranch: string
  currentBranch: string
  timestamp: number
  totalStories: number
  comparedCount: number
  changedCount: number
  passedCount: number
  failedCount: number
  results: Array<{
    storyId: string
    componentName: string
    storyName: string
    baselineUrl: string
    currentUrl: string
    diffUrl?: string
    pixelDiff: number
    ssimScore: number
    hasDiff: boolean
    renderTime?: number
  }>
}

/**
 * Upload comparison results to the web app
 */
export async function uploadCommand(options: UploadOptions = {}): Promise<void> {
  const spinner = ora('Loading configuration...').start()

  try {
    // Load config
    const config = loadConfig()
    validateConfig(config)

    const branch = options.branch || (await getCurrentBranch())
    const apiUrl = options.apiUrl || config.apiUrl

    if (!apiUrl) {
      throw new Error('API URL not configured. Set apiUrl in config or pass --api-url')
    }

    spinner.succeed('Configuration loaded')

    // Get git info
    spinner.start('Getting git info...')
    const commitHash = await getCurrentCommitHash()
    const commitMessage = await getCommitMessage()
    spinner.succeed(`Branch: ${branch}, Commit: ${commitHash.slice(0, 7)}`)

    // Find comparison results
    const currentDir = join(process.cwd(), config.screenshotDir, branch)
    const resultsPath = join(currentDir, 'comparison-results.json')

    if (!existsSync(resultsPath)) {
      throw new Error(
        `Comparison results not found at ${resultsPath}. Run 'compare' command first.`
      )
    }

    spinner.start('Loading comparison results...')
    const resultsContent = await readFile(resultsPath, 'utf-8')
    const results: ComparisonResults = JSON.parse(resultsContent)
    spinner.succeed(`Loaded ${results.results.length} story results`)

    // Prepare upload payload
    const payload = {
      branch,
      baseBranch: results.baseBranch,
      commitHash,
      commitMessage,
      stories: results.results.map((r) => ({
        storyId: r.storyId,
        componentName: r.componentName || extractComponentName(r.storyId),
        storyName: r.storyName || extractStoryName(r.storyId),
        baselineUrl: r.baselineUrl || undefined,
        currentUrl: r.currentUrl,
        diffUrl: r.diffUrl || undefined,
        pixelDiff: r.pixelDiff,
        ssimScore: r.ssimScore,
        hasDiff: r.hasDiff,
        isNew: !r.baselineUrl,
      })),
    }

    // Upload to API
    spinner.start(`Uploading to ${apiUrl}/api/upload...`)

    const response = await fetch(`${apiUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Upload failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json() as { success: boolean; testId: string; url: string }
    spinner.succeed('Upload complete!')

    // Summary
    console.log('\n' + '='.repeat(50))
    logger.success('Test results uploaded successfully')
    logger.info(`  Test ID: ${result.testId}`)
    logger.info(`  View results: ${apiUrl}${result.url}`)
    console.log('='.repeat(50))
  } catch (error) {
    spinner.fail('Upload failed')
    throw error
  }
}

/**
 * Extract component name from story ID
 * e.g., "button--primary" -> "Button"
 */
function extractComponentName(storyId: string): string {
  const parts = storyId.split('--')
  if (parts.length > 0) {
    return parts[0]
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
  }
  return storyId
}

/**
 * Extract story name from story ID
 * e.g., "button--primary" -> "Primary"
 */
function extractStoryName(storyId: string): string {
  const parts = storyId.split('--')
  if (parts.length > 1) {
    return parts[1]
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  return 'Default'
}
