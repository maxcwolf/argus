import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import ora from 'ora'
import { ComparisonResult, ComparisonConfig } from '@diffinitely/shared'
import { loadConfig, validateConfig } from '../utils/config'
import { getCurrentBranch } from '../utils/git'
import { logger } from '../utils/logger'
import { compareWithODiff, isODiffInstalled } from '../comparison/odiff'
import { compareWithPixelmatch } from '../comparison/pixelmatch'
import { calculateSSIM } from '../comparison/ssim'

export interface CompareOptions {
  base?: string
  current?: string
  threshold?: number
  generateReport?: boolean
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
    if (!existsSync(baselineDir)) {
      throw new Error(`Baseline directory not found: ${baselineDir}`)
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
    const baselineFiles = (await readdir(baselineDir)).filter((f) => f.endsWith('.png'))

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
      spinner.start('Generating HTML report...')
      await generateHTMLReport(results, currentDir, config)
      spinner.succeed('HTML report generated')
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

    // Exit with error if there are changes
    if (changedCount > 0) {
      process.exit(1)
    }
  } catch (error) {
    spinner.fail('Comparison failed')
    throw error
  }
}

/**
 * Generate HTML report for comparison results
 */
async function generateHTMLReport(
  results: ComparisonResult[],
  outputDir: string,
  config: any
): Promise<void> {
  const changedResults = results.filter((r) => r.hasDiff)
  const passedResults = results.filter((r) => !r.hasDiff)

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Regression Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { margin-bottom: 20px; color: #333; }
    .summary { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stats { display: flex; gap: 20px; margin-top: 15px; }
    .stat { flex: 1; padding: 15px; border-radius: 6px; text-align: center; }
    .stat-passed { background: #d4edda; color: #155724; }
    .stat-changed { background: #fff3cd; color: #856404; }
    .stat-failed { background: #f8d7da; color: #721c24; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { font-size: 14px; margin-top: 5px; }
    .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
    .tab { padding: 10px 20px; background: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .tab.active { background: #007bff; color: white; }
    .results { display: none; }
    .results.active { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 20px; }
    .result { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .result-header { padding: 15px; border-bottom: 1px solid #eee; }
    .result-title { font-weight: 600; color: #333; }
    .result-diff { color: #856404; font-size: 12px; margin-top: 5px; }
    .result-images { display: grid; grid-template-columns: repeat(3, 1fr); }
    .result-image { position: relative; aspect-ratio: 1; overflow: hidden; }
    .result-image img { width: 100%; height: 100%; object-fit: cover; }
    .result-image-label { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); color: white; padding: 5px; font-size: 11px; text-align: center; }
    .passed .result-header { border-left: 4px solid #28a745; }
    .changed .result-header { border-left: 4px solid #ffc107; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Visual Regression Test Report</h1>

    <div class="summary">
      <div><strong>Branch:</strong> ${results[0]?.currentUrl.includes('/') ? results[0].currentUrl.split('/').slice(-2, -1)[0] : 'unknown'}</div>
      <div><strong>Total Stories:</strong> ${results.length}</div>
      <div class="stats">
        <div class="stat stat-passed">
          <div class="stat-value">${passedResults.length}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat stat-changed">
          <div class="stat-value">${changedResults.length}</div>
          <div class="stat-label">Changed</div>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" onclick="showTab('changed')">Changed (${changedResults.length})</button>
      <button class="tab" onclick="showTab('passed')">Passed (${passedResults.length})</button>
      <button class="tab" onclick="showTab('all')">All (${results.length})</button>
    </div>

    <div id="changed-results" class="results active">
      ${changedResults.map((r) => generateResultHTML(r, 'changed')).join('')}
    </div>

    <div id="passed-results" class="results">
      ${passedResults.map((r) => generateResultHTML(r, 'passed')).join('')}
    </div>

    <div id="all-results" class="results">
      ${results.map((r) => generateResultHTML(r, r.hasDiff ? 'changed' : 'passed')).join('')}
    </div>
  </div>

  <script>
    function showTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.results').forEach(r => r.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById(tab + '-results').classList.add('active');
    }
  </script>
</body>
</html>
  `

  await writeFile(join(outputDir, 'report.html'), html.trim())
}

function generateResultHTML(result: ComparisonResult, type: string): string {
  return `
    <div class="result ${type}">
      <div class="result-header">
        <div class="result-title">${result.componentName || result.storyId} / ${result.storyName || ''}</div>
        ${result.hasDiff ? `<div class="result-diff">${result.pixelDiff.toFixed(2)}% different | SSIM: ${result.ssimScore.toFixed(3)}</div>` : ''}
      </div>
      <div class="result-images">
        <div class="result-image">
          <img src="file://${result.baselineUrl}" alt="Baseline">
          <div class="result-image-label">Baseline</div>
        </div>
        <div class="result-image">
          <img src="file://${result.currentUrl}" alt="Current">
          <div class="result-image-label">Current</div>
        </div>
        ${
          result.diffUrl
            ? `
        <div class="result-image">
          <img src="file://${result.diffUrl}" alt="Diff">
          <div class="result-image-label">Diff</div>
        </div>
        `
            : '<div class="result-image"><div class="result-image-label">No Diff</div></div>'
        }
      </div>
    </div>
  `
}
