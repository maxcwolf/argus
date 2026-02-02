import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import ora from 'ora'
import { VisualTestConfig, StoryScreenshot } from '@rn-visual-testing/shared'
import { loadConfig, validateConfig } from '../utils/config'
import { getCurrentBranch, getCurrentCommitHash } from '../utils/git'
import { logger } from '../utils/logger'
import {
  findSimulator,
  bootSimulator,
  shutdownSimulator,
  launchApp,
  terminateApp,
  captureScreenshot,
} from '../ios/simulator'
import { createStorybookClient, waitForStorybookServer, createStoryId } from '../ios/storybook'
import { measureRenderTime, collectMetrics } from '../ios/metrics'

export interface CaptureOptions {
  branch?: string
  device?: string
  skipBoot?: boolean
  skipShutdown?: boolean
}

/**
 * Capture screenshots for all stories
 */
export async function captureCommand(options: CaptureOptions = {}): Promise<void> {
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
    logger.info(`Commit: ${commitHash.substring(0, 7)}`)

    // Find simulator
    spinner.start('Finding simulator...')
    const simulator = await findSimulator(config.simulator)

    if (!simulator) {
      throw new Error(`Simulator not found: ${config.simulator.device}`)
    }

    spinner.succeed(`Found simulator: ${simulator.name}`)

    // Boot simulator
    if (!options.skipBoot) {
      spinner.start('Booting simulator...')
      await bootSimulator(simulator.udid)
      spinner.succeed('Simulator booted')
    }

    try {
      // Determine bundle ID
      const bundleId = config.simulator.bundleId || config.simulator.appScheme

      if (!bundleId) {
        throw new Error('bundleId or appScheme must be specified in config')
      }

      // Launch app with Storybook
      spinner.start('Launching app...')
      await launchApp(simulator.udid, bundleId)
      spinner.succeed('App launched')

      // Wait for Storybook server
      spinner.start('Waiting for Storybook...')
      await waitForStorybookServer(config.storybook.port)
      spinner.succeed('Storybook ready')

      // Connect to Storybook
      spinner.start('Connecting to Storybook...')
      const storybookClient = createStorybookClient(config.storybook.port)
      await storybookClient.connect()
      spinner.succeed('Connected to Storybook')

      try {
        // Get stories
        spinner.start('Loading stories...')
        const stories = await storybookClient.getStories()
        spinner.succeed(`Found ${stories.length} stories`)

        if (stories.length === 0) {
          logger.warn('No stories found')
          return
        }

        // Create output directory
        const outputDir = join(process.cwd(), config.screenshotDir, branch)
        await mkdir(outputDir, { recursive: true })

        // Capture screenshots
        const screenshots: StoryScreenshot[] = []
        let capturedCount = 0

        for (const story of stories) {
          spinner.start(`Capturing ${story.componentName}/${story.storyName} (${capturedCount + 1}/${stories.length})`)

          try {
            // Navigate to story and measure render time
            const { renderTime } = await measureRenderTime(async () => {
              await storybookClient.navigateToStory(story.id)
              await storybookClient.waitForStory()
            })

            // Generate filename
            const storyId = createStoryId(story.componentName, story.storyName)
            const filename = `${storyId}.png`
            const filePath = join(outputDir, filename)

            // Capture screenshot
            await captureScreenshot(simulator.udid, filePath)

            // Collect metrics
            const metrics = collectMetrics(renderTime)

            // Record screenshot
            screenshots.push({
              storyId,
              componentName: story.componentName,
              storyName: story.storyName,
              filePath,
              branch,
              commitHash,
              timestamp: Date.now(),
              renderTime: metrics.renderTime,
            })

            capturedCount++
            spinner.succeed(
              `Captured ${story.componentName}/${story.storyName} (${capturedCount}/${stories.length}) - ${renderTime}ms`
            )
          } catch (error) {
            spinner.fail(`Failed to capture ${story.componentName}/${story.storyName}`)
            logger.error(`${error}`)
          }
        }

        // Save metadata
        const metadataPath = join(outputDir, 'metadata.json')
        await writeFile(
          metadataPath,
          JSON.stringify(
            {
              branch,
              commitHash,
              timestamp: Date.now(),
              screenshots,
              totalStories: stories.length,
              capturedCount,
            },
            null,
            2
          )
        )

        logger.success(`\nCaptured ${capturedCount}/${stories.length} screenshots`)
        logger.info(`Screenshots saved to: ${outputDir}`)
      } finally {
        storybookClient.disconnect()
      }

      // Terminate app
      await terminateApp(simulator.udid, bundleId)
    } finally {
      // Shutdown simulator
      if (!options.skipShutdown) {
        spinner.start('Shutting down simulator...')
        await shutdownSimulator(simulator.udid)
        spinner.succeed('Simulator shutdown')
      }
    }
  } catch (error) {
    spinner.fail('Capture failed')
    throw error
  }
}
