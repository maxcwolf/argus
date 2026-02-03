import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import ora from 'ora'
import { execa } from 'execa'
import { StoryScreenshot } from '@rn-visual-testing/shared'
import { loadConfig, validateConfig } from '../utils/config'
import { getCurrentBranch, getCurrentCommitHash } from '../utils/git'
import { logger } from '../utils/logger'
import { findSimulator, captureScreenshot } from '../ios/simulator'
import { getAllStories, generateStoryId } from '../storybook/parser'

export interface CaptureAllOptions {
  branch?: string
  scheme?: string
  delay?: number
  filter?: string
  skipBoot?: boolean
}

/**
 * Capture screenshots of all stories using deep linking
 */
export async function captureAllCommand(options: CaptureAllOptions = {}): Promise<void> {
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

    // Get URL scheme from config or options
    const scheme = options.scheme || config.storybook.scheme || 'app.formhealth.io'
    logger.info(`Using URL scheme: ${scheme}`)

    // Find simulator
    spinner.start('Finding simulator...')
    const simulator = await findSimulator(config.simulator)

    if (!simulator) {
      throw new Error(`Simulator not found: ${config.simulator.device}`)
    }

    if (simulator.state !== 'Booted') {
      throw new Error(`Simulator is not booted. Please boot it and launch the app with Storybook enabled.`)
    }

    spinner.succeed(`Found simulator: ${simulator.name} (${simulator.state})`)

    // Parse story files
    spinner.start('Parsing story files...')
    let stories = await getAllStories(
      process.cwd(),
      config.storybook.storiesPattern || 'src/**/*.stories.tsx'
    )

    // Filter stories if pattern provided
    if (options.filter) {
      const filterRegex = new RegExp(options.filter, 'i')
      stories = stories.filter(
        (s) =>
          filterRegex.test(s.id) ||
          filterRegex.test(s.componentName) ||
          filterRegex.test(s.storyName) ||
          filterRegex.test(s.title)
      )
    }

    spinner.succeed(`Found ${stories.length} stories to capture`)

    if (stories.length === 0) {
      logger.warn('No stories found matching criteria')
      return
    }

    // Create output directory
    const outputDir = join(process.cwd(), config.screenshotDir, branch)
    await mkdir(outputDir, { recursive: true })

    // Capture delay (time to wait for story to render)
    const delay = options.delay ?? 1500

    // Capture screenshots
    const screenshots: StoryScreenshot[] = []
    let capturedCount = 0
    let failedCount = 0

    for (const story of stories) {
      spinner.start(
        `Capturing ${story.title}/${story.storyName} (${capturedCount + 1}/${stories.length})`
      )

      try {
        // Navigate to story via deep link
        const url = `${scheme}://?STORYBOOK_STORY_ID=${story.id}`
        await execa('xcrun', ['simctl', 'openurl', simulator.udid, url])

        // Wait for story to render
        await new Promise((resolve) => setTimeout(resolve, delay))

        // Generate filename
        const filename = `${story.id}.png`
        const filePath = join(outputDir, filename)

        // Capture screenshot
        const startTime = performance.now()
        await captureScreenshot(simulator.udid, filePath)
        const renderTime = Math.round(performance.now() - startTime)

        // Record screenshot
        screenshots.push({
          storyId: story.id,
          componentName: story.componentName,
          storyName: story.storyName,
          filePath,
          branch,
          commitHash,
          timestamp: Date.now(),
          renderTime,
        })

        capturedCount++
        spinner.succeed(
          `Captured ${story.title}/${story.storyName} (${capturedCount}/${stories.length})`
        )
      } catch (error) {
        failedCount++
        spinner.fail(`Failed to capture ${story.title}/${story.storyName}`)
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
          failedCount,
        },
        null,
        2
      )
    )

    // Summary
    console.log('\n' + '='.repeat(50))
    logger.success(`Capture complete!`)
    logger.info(`  Total stories: ${stories.length}`)
    logger.info(`  Captured: ${capturedCount}`)
    logger.info(`  Failed: ${failedCount}`)
    logger.info(`\nScreenshots saved to: ${outputDir}`)
    console.log('='.repeat(50))
  } catch (error) {
    spinner.fail('Capture failed')
    throw error
  }
}
