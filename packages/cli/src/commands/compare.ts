import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import ora from 'ora'
import { ComparisonResult, ComparisonConfig } from '@argus-vrt/shared'
import { loadConfig, validateConfig } from '../utils/config'
import { getCurrentBranch } from '../utils/git'
import { logger } from '../utils/logger'
import { compareWithODiff, isODiffInstalled } from '../comparison/odiff'
import { compareWithPixelmatch } from '../comparison/pixelmatch'
import { calculateSSIM } from '../comparison/ssim'
import { generateReport } from '../report/html'

export interface CompareOptions {
  base?: string
  current?: string
  threshold?: number
  generateReport?: boolean
  portable?: boolean
}

/**
 * Compare current screenshots against baselines
 */
export async function compareCommand(options: CompareOptions = {}): Promise<void> {
  const spinner = ora('Loading configuration...').start()

  try {
    // Load config
    const config = loadConfig()
    validateConfig(config)

    // Get branches
    const baseBranch = options.base || 'main'
    const currentBranch = options.current || (await getCurrentBranch())

    spinner.succeed('Configuration loaded')
    logger.info(`Comparing ${currentBranch} against ${baseBranch}`)

    // Check if ODiff is available
    const useODiff = await isODiffInstalled()
    if (useODiff) {
      logger.info('Using ODiff for fast comparison')
    } else {
      logger.info('Using Pixelmatch for comparison (install odiff for faster results)')
    }

    // Get baseline and current directories
    const baselineDir = join(process.cwd(), config.baselineDir, 'ios', config.simulator.device.replace(/\s+/g, ''))
    const currentDir = join(process.cwd(), config.screenshotDir, currentBranch)

    // Check directories exist
    const hasBaselines = existsSync(baselineDir)

    if (!hasBaselines) {
      logger.warn(`No baselines found at ${baselineDir} — all screenshots will be reported as new`)
    }

    if (!existsSync(currentDir)) {
      throw new Error(`Screenshot directory not found: ${currentDir}`)
    }

    // Load current screenshots metadata
    const metadataPath = join(currentDir, 'metadata.json')
    let metadata: any = {}

    if (existsSync(metadataPath)) {
      const metadataContent = await readFile(metadataPath, 'utf-8')
      metadata = JSON.parse(metadataContent)
    }

    // Get screenshot files
    const currentFiles = (await readdir(currentDir)).filter((f) => f.endsWith('.png') && f !== 'metadata.json')
    const baselineFiles = hasBaselines
      ? (await readdir(baselineDir)).filter((f) => f.endsWith('.png'))
      : []

    spinner.succeed(`Found ${currentFiles.length} current screenshots, ${baselineFiles.length} baselines`)

    // Create diff output directory
    const diffDir = join(currentDir, 'diffs')
    await mkdir(diffDir, { recursive: true })

    // Compare images
    const results: ComparisonResult[] = []
    const threshold = options.threshold ?? config.comparison.threshold
    let comparedCount = 0
    let changedCount = 0
    let passedCount = 0
    let failedCount = 0

    for (const filename of currentFiles) {
      spinner.start(`Comparing ${filename} (${comparedCount + 1}/${currentFiles.length})`)

      const currentPath = join(currentDir, filename)
      const baselinePath = join(baselineDir, filename)

      // Check if baseline exists
      if (!existsSync(baselinePath)) {
        logger.warn(`No baseline found for ${filename}`)
        results.push({
          storyId: filename.replace('.png', ''),
          componentName: '',
          storyName: '',
          baselineUrl: '',
          currentUrl: currentPath,
          pixelDiff: 100,
          ssimScore: 0,
          hasDiff: true,
        })
        failedCount++
        comparedCount++
        continue
      }

      try {
        const diffPath = join(diffDir, filename)

        // Try ODiff first, fallback to Pixelmatch
        let pixelDiff = 0
        let hasDiff = false

        if (useODiff) {
          const odiffResult = await compareWithODiff(baselinePath, currentPath, diffPath, threshold)

          if (odiffResult) {
            pixelDiff = odiffResult.diffPercentage
            hasDiff = !odiffResult.match
          }
        }

        // Fallback to Pixelmatch if ODiff not available or failed
        if (!useODiff) {
          const pixelmatchResult = await compareWithPixelmatch(baselinePath, currentPath, diffPath, 0.1)
          pixelDiff = pixelmatchResult.diffPercentage
          hasDiff = pixelDiff > threshold * 100
        }

        // Calculate SSIM
        const ssimResult = await calculateSSIM(baselinePath, currentPath)

        // Get metadata for this story
        const storyMetadata = metadata.screenshots?.find((s: any) => s.filePath.endsWith(filename))

        results.push({
          storyId: filename.replace('.png', ''),
          kind: storyMetadata?.kind || '',
          componentName: storyMetadata?.componentName || '',
          storyName: storyMetadata?.storyName || '',
          baselineUrl: baselinePath,
          currentUrl: currentPath,
          diffUrl: hasDiff ? diffPath : undefined,
          pixelDiff,
          ssimScore: ssimResult.score,
          hasDiff,
          renderTime: storyMetadata?.renderTime,
        })

        if (hasDiff) {
          changedCount++
          failedCount++
          spinner.warn(`${filename}: ${pixelDiff.toFixed(2)}% different`)
        } else {
          passedCount++
          spinner.succeed(`${filename}: passed`)
        }

        comparedCount++
      } catch (error) {
        spinner.fail(`Failed to compare ${filename}`)
        logger.error(`${error}`)
        failedCount++
        comparedCount++
      }
    }

    // Save results
    const resultsPath = join(currentDir, 'comparison-results.json')
    await writeFile(
      resultsPath,
      JSON.stringify(
        {
          baseBranch,
          currentBranch,
          timestamp: Date.now(),
          totalStories: currentFiles.length,
          comparedCount,
          changedCount,
          passedCount,
          failedCount,
          results,
        },
        null,
        2
      )
    )

    // Generate HTML report if requested
    if (options.generateReport !== false) {
      const portable = options.portable ?? false
      spinner.start(portable ? 'Generating portable HTML report (embedding images)...' : 'Generating HTML report...')
      const html = await generateReport({
        results,
        branch: currentBranch,
        baseBranch,
        portable,
      })
      await writeFile(join(currentDir, 'report.html'), html)
      spinner.succeed(portable ? 'Portable HTML report generated' : 'HTML report generated')
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    logger.success(`Comparison complete: ${comparedCount} stories`)
    logger.info(`  Passed: ${passedCount}`)
    logger.info(`  Changed: ${changedCount}`)
    logger.info(`  Failed: ${failedCount}`)
    logger.info(`\nResults saved to: ${resultsPath}`)

    if (options.generateReport !== false) {
      logger.info(`HTML report: ${join(currentDir, 'report.html')}`)
    }

    console.log('='.repeat(50))

    // Signal changes detected (callers like test.ts will handle exit code)
    if (changedCount > 0) {
      throw new Error(`${changedCount} visual changes detected`)
    }
  } catch (error) {
    spinner.fail('Comparison failed')
    throw error
  }
}

