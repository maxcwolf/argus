import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import ora from 'ora'
import { loadConfig, validateConfig } from '../utils/config'
import { getCurrentBranch, getCurrentCommitHash } from '../utils/git'
import { logger } from '../utils/logger'
import { findSimulator, captureScreenshot } from '../ios/simulator'

export interface ScreenshotOptions {
  name?: string
  branch?: string
}

/**
 * Capture a single screenshot of the current screen
 */
export async function screenshotCommand(options: ScreenshotOptions = {}): Promise<void> {
  const spinner = ora('Loading configuration...').start()

  try {
    // Load and validate config
    const config = loadConfig()
    validateConfig(config)

    // Get git info
    const branch = options.branch || (await getCurrentBranch())
    const commitHash = await getCurrentCommitHash()

    spinner.succeed('Configuration loaded')
    logger.info(`Branch: ${branch}`)

    // Find simulator
    spinner.start('Finding simulator...')
    const simulator = await findSimulator(config.simulator)

    if (!simulator) {
      throw new Error(`Simulator not found: ${config.simulator.device}`)
    }

    if (simulator.state !== 'Booted') {
      throw new Error(`Simulator is not booted. Please boot it first.`)
    }

    spinner.succeed(`Found simulator: ${simulator.name} (${simulator.state})`)

    // Create output directory
    const outputDir = join(process.cwd(), config.screenshotDir, branch)
    await mkdir(outputDir, { recursive: true })

    // Generate filename
    const name = options.name || `screenshot-${Date.now()}`
    const filename = `${name}.png`
    const filePath = join(outputDir, filename)

    // Capture screenshot
    spinner.start('Capturing screenshot...')
    await captureScreenshot(simulator.udid, filePath)
    spinner.succeed(`Screenshot saved: ${filePath}`)

    // Save metadata
    const metadataPath = join(outputDir, 'metadata.json')
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          branch,
          commitHash,
          timestamp: Date.now(),
          screenshots: [{ name, filePath, timestamp: Date.now() }],
        },
        null,
        2
      )
    )

    logger.success(`\nScreenshot captured successfully!`)
    logger.info(`File: ${filePath}`)
  } catch (error) {
    spinner.fail('Screenshot capture failed')
    throw error
  }
}
