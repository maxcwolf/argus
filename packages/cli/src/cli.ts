#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { captureCommand } from './commands/capture'
import { compareCommand } from './commands/compare'
import { screenshotCommand } from './commands/screenshot'
import { listStoriesCommand } from './commands/list-stories'
import { captureAllCommand } from './commands/capture-all'
import { uploadCommand } from './commands/upload'
import { initCommand } from './commands/init'
import { baselineCommand } from './commands/baseline'
import { testCommand } from './commands/test'

const program = new Command()

program
  .name('argus')
  .description('Argus - Visual Regression Testing for React Native')
  .version('0.1.0')

// Main commands (most commonly used)

program
  .command('test')
  .description('Run complete visual test: capture, compare, and upload')
  .option('-b, --branch <branch>', 'Override current git branch')
  .option('--base <branch>', 'Base branch for comparison (default: main)')
  .option('--skip-capture', 'Skip screenshot capture (use existing)')
  .option('--skip-upload', 'Skip uploading results')
  .option('-t, --threshold <threshold>', 'Difference threshold (0-1)', parseFloat)
  .action(async (options) => {
    try {
      await testCommand(options)
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
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    try {
      await initCommand(options)
    } catch (error: any) {
      console.error(chalk.red('\n✖ Error:'), error.message)
      if (process.env.DEBUG) {
        console.error(error.stack)
      }
      process.exit(1)
    }
  })

program
  .command('baseline')
  .description('Manage visual baselines')
  .option('--update', 'Update baselines from current screenshots')
  .option('--clear', 'Clear all baselines')
  .option('-b, --branch <branch>', 'Branch to use for screenshots (default: current)')
  .action(async (options) => {
    try {
      await baselineCommand(options)
    } catch (error: any) {
      console.error(chalk.red('\n✖ Error:'), error.message)
      if (process.env.DEBUG) {
        console.error(error.stack)
      }
      process.exit(1)
    }
  })

// Individual step commands

program
  .command('capture-all')
  .description('Capture screenshots of all stories')
  .option('-b, --branch <branch>', 'Override current git branch')
  .option('-s, --scheme <scheme>', 'URL scheme for deep linking')
  .option('-d, --delay <ms>', 'Delay between captures in ms (default: 1500)', parseInt)
  .option('-f, --filter <pattern>', 'Filter stories by regex pattern')
  .option('--skip-shutdown', 'Keep simulator running after capture')
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
  .command('upload')
  .description('Upload comparison results to the web dashboard')
  .option('-b, --branch <branch>', 'Override current git branch')
  .option('-u, --api-url <url>', 'Override API URL from config')
  .action(async (options) => {
    try {
      await uploadCommand(options)
    } catch (error: any) {
      console.error(chalk.red('\n✖ Error:'), error.message)
      if (process.env.DEBUG) {
        console.error(error.stack)
      }
      process.exit(1)
    }
  })

// Utility commands

program
  .command('capture')
  .description('Capture screenshots (legacy, use capture-all instead)')
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
  .command('screenshot')
  .description('Capture a single screenshot')
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
