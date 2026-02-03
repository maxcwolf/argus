import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import ora from 'ora'
import { execSync } from 'child_process'
import { CONFIG_FILE_NAME } from '@argus-vrt/shared'
import { logger } from '../utils/logger'

interface InitOptions {
  force?: boolean
}

/**
 * Interactive initialization wizard
 */
export async function initCommand(options: InitOptions = {}): Promise<void> {
  const configPath = join(process.cwd(), CONFIG_FILE_NAME)

  // Check if config already exists
  if (existsSync(configPath) && !options.force) {
    logger.warn(`${CONFIG_FILE_NAME} already exists. Use --force to overwrite.`)
    return
  }

  console.log('\n👁️ Argus - Visual Regression Testing for React Native\n')
  console.log('Setting up visual testing for your project...\n')

  const spinner = ora('Detecting project configuration...').start()

  // Detect Storybook config
  let storybookPort = 7007
  let storiesPattern = 'src/**/*.stories.?(ts|tsx|js|jsx)'

  const storybookConfigPaths = [
    '.storybook/main.ts',
    '.storybook/main.js',
    '.rnstorybook/main.ts',
    '.rnstorybook/main.js',
  ]

  for (const configPath of storybookConfigPaths) {
    if (existsSync(join(process.cwd(), configPath))) {
      spinner.text = `Found Storybook config at ${configPath}`
      try {
        const content = await readFile(join(process.cwd(), configPath), 'utf-8')
        // Try to extract stories pattern
        const storiesMatch = content.match(/stories:\s*\[['"]([^'"]+)['"]/);
        if (storiesMatch) {
          storiesPattern = storiesMatch[1]
        }
      } catch {
        // Ignore read errors
      }
      break
    }
  }

  // Detect available simulators
  let deviceName = 'iPhone 15 Pro'
  let osVersion = 'iOS 17.0'

  try {
    const simulators = execSync('xcrun simctl list devices available -j', { encoding: 'utf-8' })
    const data = JSON.parse(simulators)

    // Find the latest iOS runtime with devices
    const runtimes = Object.keys(data.devices)
      .filter(r => r.includes('iOS'))
      .sort()
      .reverse()

    if (runtimes.length > 0) {
      const latestRuntime = runtimes[0]
      osVersion = latestRuntime.replace('com.apple.CoreSimulator.SimRuntime.', '').replace('-', ' ').replace('.', ' ')

      const devices = data.devices[latestRuntime]
      if (devices && devices.length > 0) {
        // Prefer Pro models
        const proDevice = devices.find((d: any) => d.name.includes('Pro') && !d.name.includes('Max'))
        deviceName = proDevice ? proDevice.name : devices[0].name
      }
    }
    spinner.succeed('Detected iOS simulators')
  } catch {
    spinner.warn('Could not detect simulators, using defaults')
  }

  // Detect app bundle ID from Expo or React Native config
  let bundleId = 'com.example.app'
  let scheme = 'myapp'

  // Check for Expo app.json
  if (existsSync(join(process.cwd(), 'app.json'))) {
    try {
      const appJson = JSON.parse(await readFile(join(process.cwd(), 'app.json'), 'utf-8'))
      if (appJson.expo?.ios?.bundleIdentifier) {
        bundleId = appJson.expo.ios.bundleIdentifier
      }
      if (appJson.expo?.scheme) {
        scheme = appJson.expo.scheme
      }
      spinner.succeed('Detected Expo configuration')
    } catch {
      // Ignore
    }
  }

  // Create config
  const config = {
    storybook: {
      port: storybookPort,
      storiesPattern,
      scheme,
    },
    simulator: {
      device: deviceName,
      os: osVersion,
      bundleId,
    },
    comparison: {
      mode: 'threshold',
      threshold: 0.01,
      includeMetrics: true,
    },
    baselineDir: '.visual-baselines',
    screenshotDir: '.visual-screenshots',
  }

  // Write config
  spinner.start('Creating configuration file...')
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n')
  spinner.succeed(`Created ${CONFIG_FILE_NAME}`)

  // Update .gitignore
  const gitignorePath = join(process.cwd(), '.gitignore')
  if (existsSync(gitignorePath)) {
    const gitignore = await readFile(gitignorePath, 'utf-8')
    const additions: string[] = []

    if (!gitignore.includes('.visual-screenshots')) {
      additions.push('.visual-screenshots/')
    }

    if (additions.length > 0) {
      await writeFile(gitignorePath, gitignore + '\n# Argus\n' + additions.join('\n') + '\n')
      spinner.succeed('Updated .gitignore')
    }
  }

  // Check for package.json and suggest scripts
  const packageJsonPath = join(process.cwd(), 'package.json')
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

    console.log('\n📝 Add these scripts to your package.json:\n')
    console.log('  "scripts": {')
    console.log('    "visual:test": "argus test",')
    console.log('    "visual:capture": "argus capture-all",')
    console.log('    "visual:compare": "argus compare",')
    console.log('    "visual:baseline": "argus baseline --update"')
    console.log('  }')
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('\n✅ Argus initialized!\n')
  console.log('Configuration saved to:', CONFIG_FILE_NAME)
  console.log('\nDetected settings:')
  console.log(`  • Simulator: ${deviceName} (${osVersion})`)
  console.log(`  • Bundle ID: ${bundleId}`)
  console.log(`  • URL Scheme: ${scheme}`)
  console.log(`  • Stories: ${storiesPattern}`)
  console.log('\nNext steps:')
  console.log('  1. Review and edit', CONFIG_FILE_NAME)
  console.log('  2. Run: argus capture-all')
  console.log('  3. Run: argus baseline --update')
  console.log('  4. Make UI changes and run: argus test')
  console.log('\n' + '='.repeat(50) + '\n')
}
