#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { captureCommand } from './commands/capture'
import { compareCommand } from './commands/compare'
import { screenshotCommand } from './commands/screenshot'
import { listStoriesCommand } from './commands/list-stories'
import { captureAllCommand } from './commands/capture-all'

const program = new Command()

program
  .name('rn-visual-test')
  .description('Visual regression testing for React Native Storybook')
  .version('0.1.0')

program
  .command('capture')
  .description('Capture screenshots of all Storybook stories')
  .option('-b, --branch <branch>', 'Override current git branch')
  .option('-d, --device <device>', 'Override simulator device')
  .option('--skip-boot', 'Skip booting the simulator')
  .option('--skip-shutdown', 'Skip shutting down the simulator')
  .action(async (options) => {
    try {
      await captureCommand(options)
    } catch (error: any) {
      console.error(chalk.red('\n✖ Error:'), error.message)
      if (process.env.DEBUG) {
        console.error(error.stack)
      }
      process.exit(1)
    }
  })

program
  .command('compare')
  .description('Compare screenshots against baselines')
  .option('--base <branch>', 'Base branch for comparison (default: main)')
  .option('--current <branch>', 'Current branch (default: current git branch)')
  .option('-t, --threshold <threshold>', 'Difference threshold (0-1)', parseFloat)
  .option('--no-report', 'Skip HTML report generation')
  .action(async (options) => {
    try {
      await compareCommand(options)
    } catch (error: any) {
      console.error(chalk.red('\n✖ Error:'), error.message)
      if (process.env.DEBUG) {
        console.error(error.stack)
      }
      process.exit(1)
    }
  })

program
  .command('screenshot')
  .description('Capture a single screenshot of the current simulator screen')
  .option('-n, --name <name>', 'Name for the screenshot')
  .option('-b, --branch <branch>', 'Override current git branch')
  .action(async (options) => {
    try {
      await screenshotCommand(options)
    } catch (error: any) {
      console.error(chalk.red('\n✖ Error:'), error.message)
      if (process.env.DEBUG) {
        console.error(error.stack)
      }
      process.exit(1)
    }
  })

program
  .command('list-stories')
  .description('List all stories in the project')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      await listStoriesCommand(options)
    } catch (error: any) {
      console.error(chalk.red('\n✖ Error:'), error.message)
      if (process.env.DEBUG) {
        console.error(error.stack)
      }
      process.exit(1)
    }
  })

program
  .command('capture-all')
  .description('Capture screenshots of all stories using deep linking')
  .option('-b, --branch <branch>', 'Override current git branch')
  .option('-s, --scheme <scheme>', 'URL scheme for deep linking (default: from config)')
  .option('-d, --delay <ms>', 'Delay between captures in ms (default: 1500)', parseInt)
  .option('-f, --filter <pattern>', 'Filter stories by regex pattern')
  .action(async (options) => {
    try {
      await captureAllCommand(options)
    } catch (error: any) {
      console.error(chalk.red('\n✖ Error:'), error.message)
      if (process.env.DEBUG) {
        console.error(error.stack)
      }
      process.exit(1)
    }
  })

program
  .command('init')
  .description('Initialize visual testing in current project')
  .action(async () => {
    const { writeFile, mkdir } = await import('fs/promises')
    const { join } = await import('path')

    try {
      // Create config file
      const config = {
        storybook: {
          port: 7007,
          storiesPattern: 'src/**/__stories__/**/*.stories.?(ts|tsx|js|jsx)',
        },
        simulator: {
          device: 'iPhone 15 Pro',
          os: 'iOS 17.0',
          appScheme: 'your-app-scheme',
        },
        comparison: {
          mode: 'threshold',
          threshold: 0.01,
          includeMetrics: true,
        },
        baselineDir: '.visual-baselines',
        screenshotDir: '.visual-screenshots',
      }

      await writeFile(join(process.cwd(), '.rn-visual-testing.json'), JSON.stringify(config, null, 2))

      // Create baseline directory
      await mkdir(join(process.cwd(), '.visual-baselines', 'ios'), { recursive: true })

      console.log(chalk.green('✓ Visual testing initialized!'))
      console.log('\nNext steps:')
      console.log('  1. Update .rn-visual-testing.json with your app settings')
      console.log('  2. Run: rn-visual-test capture')
      console.log('  3. Copy screenshots to baselines: cp -r .visual-screenshots/<branch>/* .visual-baselines/ios/')
      console.log('  4. Make UI changes and run: rn-visual-test compare')
    } catch (error: any) {
      console.error(chalk.red('✖ Initialization failed:'), error.message)
      process.exit(1)
    }
  })

// Error handler
program.exitOverride()

try {
  program.parse()
} catch (error: any) {
  if (error.code !== 'commander.help' && error.code !== 'commander.version') {
    console.error(chalk.red('✖ Error:'), error.message)
    process.exit(1)
  }
}
