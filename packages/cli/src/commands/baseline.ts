import { readdir, copyFile, mkdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import ora from 'ora'
import { loadConfig, validateConfig } from '../utils/config'
import { getCurrentBranch } from '../utils/git'
import { logger } from '../utils/logger'

export interface BaselineOptions {
  update?: boolean
  clear?: boolean
  branch?: string
}

/**
 * Manage visual baselines
 */
export async function baselineCommand(options: BaselineOptions = {}): Promise<void> {
  const spinner = ora('Loading configuration...').start()

  try {
    const config = loadConfig()
    validateConfig(config)
    spinner.succeed('Configuration loaded')

    const deviceDir = config.simulator.device.replace(/\s+/g, '')
    const baselineDir = join(process.cwd(), config.baselineDir, 'ios', deviceDir)
    const branch = options.branch || (await getCurrentBranch())
    const screenshotDir = join(process.cwd(), config.screenshotDir, branch)

    // Clear baselines
    if (options.clear) {
      if (!existsSync(baselineDir)) {
        logger.warn('No baselines to clear')
        return
      }

      spinner.start('Clearing baselines...')
      await rm(baselineDir, { recursive: true, force: true })
      spinner.succeed('Baselines cleared')
      return
    }

    // Update baselines from current screenshots
    if (options.update) {
      if (!existsSync(screenshotDir)) {
        throw new Error(
          `Screenshot directory not found: ${screenshotDir}\n` +
          `Run 'diffinitely capture-all' first to capture screenshots.`
        )
      }

      spinner.start('Updating baselines from current screenshots...')

      // Create baseline directory
      await mkdir(baselineDir, { recursive: true })

      // Get screenshot files
      const files = (await readdir(screenshotDir)).filter(
        (f) => f.endsWith('.png') && !f.startsWith('.')
      )

      if (files.length === 0) {
        throw new Error('No screenshots found to use as baselines')
      }

      // Copy files
      let copied = 0
      for (const file of files) {
        const src = join(screenshotDir, file)
        const dest = join(baselineDir, file)
        await copyFile(src, dest)
        copied++
        spinner.text = `Copying baselines... ${copied}/${files.length}`
      }

      spinner.succeed(`Updated ${copied} baselines`)

      console.log('\n' + '='.repeat(50))
      logger.success('Baselines updated!')
      logger.info(`  Location: ${baselineDir}`)
      logger.info(`  Files: ${copied} screenshots`)
      console.log('\nDon\'t forget to commit your baselines:')
      console.log(`  git add ${config.baselineDir}`)
      console.log('  git commit -m "chore: update visual baselines"')
      console.log('='.repeat(50) + '\n')
      return
    }

    // Default: show baseline status
    spinner.stop()

    console.log('\n📊 Baseline Status\n')

    if (!existsSync(baselineDir)) {
      console.log('No baselines found.\n')
      console.log('To create baselines from current screenshots:')
      console.log('  1. Run: diffinitely capture-all')
      console.log('  2. Run: diffinitely baseline --update\n')
      return
    }

    const baselineFiles = (await readdir(baselineDir)).filter((f) => f.endsWith('.png'))
    console.log(`Baseline directory: ${baselineDir}`)
    console.log(`Total baselines: ${baselineFiles.length}\n`)

    // Check if screenshots exist for comparison
    if (existsSync(screenshotDir)) {
      const screenshotFiles = (await readdir(screenshotDir)).filter(
        (f) => f.endsWith('.png') && !f.startsWith('.')
      )

      const newStories = screenshotFiles.filter((f) => !baselineFiles.includes(f))
      const missingScreenshots = baselineFiles.filter((f) => !screenshotFiles.includes(f))

      if (newStories.length > 0) {
        console.log(`New stories (no baseline): ${newStories.length}`)
      }
      if (missingScreenshots.length > 0) {
        console.log(`Missing screenshots: ${missingScreenshots.length}`)
      }
    }

    console.log('\nCommands:')
    console.log('  diffinitely baseline --update   Update baselines from screenshots')
    console.log('  diffinitely baseline --clear    Remove all baselines\n')
  } catch (error) {
    spinner.fail('Baseline operation failed')
    throw error
  }
}
