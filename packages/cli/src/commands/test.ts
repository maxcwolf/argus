import ora from 'ora'
import { loadConfig, validateConfig } from '../utils/config'
import { getCurrentBranch } from '../utils/git'
import { logger } from '../utils/logger'
import { captureAllCommand } from './capture-all'
import { compareCommand } from './compare'
import { uploadCommand } from './upload'

export interface TestOptions {
  branch?: string
  base?: string
  skipCapture?: boolean
  skipUpload?: boolean
  threshold?: number
}

/**
 * Run a complete visual test cycle: capture, compare, and optionally upload
 */
export async function testCommand(options: TestOptions = {}): Promise<void> {
  console.log('\n🔍 Diffinitely - Visual Regression Test\n')
  console.log('='.repeat(50))

  const config = loadConfig()
  validateConfig(config)

  const branch = options.branch || (await getCurrentBranch())
  const baseBranch = options.base || 'main'

  console.log(`Branch: ${branch}`)
  console.log(`Comparing against: ${baseBranch}`)
  console.log('='.repeat(50) + '\n')

  const startTime = Date.now()

  try {
    // Step 1: Capture screenshots
    if (!options.skipCapture) {
      console.log('\n📸 Step 1: Capturing Screenshots\n')
      await captureAllCommand({
        branch,
        skipShutdown: true, // Keep simulator running in case of re-runs
      })
    } else {
      console.log('\n📸 Step 1: Capture (skipped)\n')
    }

    // Step 2: Compare against baselines
    console.log('\n🔍 Step 2: Comparing Against Baselines\n')
    let hasChanges = false
    try {
      await compareCommand({
        base: baseBranch,
        current: branch,
        threshold: options.threshold,
        generateReport: true,
      })
    } catch (error: any) {
      // Compare exits with code 1 if there are changes
      if (error.message?.includes('changes detected') || process.exitCode === 1) {
        hasChanges = true
        process.exitCode = 0 // Reset for now, we'll set it at the end
      } else {
        throw error
      }
    }

    // Step 3: Upload results (if configured and not skipped)
    if (config.apiUrl && !options.skipUpload) {
      console.log('\n📤 Step 3: Uploading Results\n')
      try {
        await uploadCommand({ branch })
      } catch (error) {
        logger.warn('Upload failed - results saved locally')
      }
    } else if (!config.apiUrl) {
      console.log('\n📤 Step 3: Upload (skipped - no apiUrl configured)\n')
    } else {
      console.log('\n📤 Step 3: Upload (skipped)\n')
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('\n' + '='.repeat(50))
    if (hasChanges) {
      logger.warn(`Visual test completed with changes (${duration}s)`)
      console.log('\nVisual differences were detected.')
      console.log('Review the changes and update baselines if intended:')
      console.log('  diffinitely baseline --update')
      console.log('='.repeat(50) + '\n')
      process.exitCode = 1
    } else {
      logger.success(`Visual test passed! (${duration}s)`)
      console.log('\nNo visual differences detected.')
      console.log('='.repeat(50) + '\n')
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('\n' + '='.repeat(50))
    logger.error(`Visual test failed (${duration}s)`)
    console.log('='.repeat(50) + '\n')
    throw error
  }
}
