import { execaCommand } from 'execa'
import { existsSync } from 'fs'
import { logger } from '../utils/logger'

export interface ODiffResult {
  match: boolean
  diffPercentage: number
  diffPixels: number
  diffImagePath?: string
}

/**
 * Compare images using ODiff (if available)
 * Falls back to indicating ODiff is not installed
 */
export async function compareWithODiff(
  baselinePath: string,
  currentPath: string,
  diffPath?: string,
  threshold = 0.01
): Promise<ODiffResult | null> {
  try {
    // Check if odiff is installed
    try {
      await execaCommand('which odiff')
    } catch {
      logger.debug('ODiff not found, skipping')
      return null
    }

    // Build odiff command
    let cmd = `odiff "${baselinePath}" "${currentPath}" --threshold ${threshold}`

    if (diffPath) {
      cmd += ` --diff-image "${diffPath}"`
    }

    try {
      const { stdout } = await execaCommand(cmd)

      // Parse odiff output
      const diffMatch = stdout.match(/Difference: ([\d.]+)%/)
      const diffPercentage = diffMatch ? parseFloat(diffMatch[1]) : 0

      return {
        match: diffPercentage <= threshold * 100,
        diffPercentage,
        diffPixels: 0, // ODiff doesn't provide this
        diffImagePath: diffPath && diffPercentage > 0 ? diffPath : undefined,
      }
    } catch (error: any) {
      // ODiff exits with non-zero code when images differ
      if (error.stdout) {
        const diffMatch = error.stdout.match(/Difference: ([\d.]+)%/)
        const diffPercentage = diffMatch ? parseFloat(diffMatch[1]) : 100

        return {
          match: false,
          diffPercentage,
          diffPixels: 0,
          diffImagePath: diffPath && existsSync(diffPath) ? diffPath : undefined,
        }
      }

      throw error
    }
  } catch (error) {
    logger.warn(`ODiff comparison failed: ${error}`)
    return null
  }
}

/**
 * Check if ODiff is installed
 */
export async function isODiffInstalled(): Promise<boolean> {
  try {
    await execaCommand('which odiff')
    return true
  } catch {
    return false
  }
}
