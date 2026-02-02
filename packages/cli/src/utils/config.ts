import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { VisualTestConfig, DEFAULT_CONFIG, CONFIG_FILE_NAME } from '@rn-visual-testing/shared'

/**
 * Load configuration from project root
 */
export function loadConfig(cwd: string = process.cwd()): VisualTestConfig {
  const configPath = join(cwd, CONFIG_FILE_NAME)

  if (!existsSync(configPath)) {
    console.warn(`No ${CONFIG_FILE_NAME} found, using defaults`)
    return DEFAULT_CONFIG as VisualTestConfig
  }

  try {
    const configContent = readFileSync(configPath, 'utf-8')
    const userConfig = JSON.parse(configContent)

    // Merge with defaults
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      storybook: {
        ...DEFAULT_CONFIG.storybook,
        ...userConfig.storybook,
      },
      simulator: {
        ...DEFAULT_CONFIG.simulator,
        ...userConfig.simulator,
      },
      comparison: {
        ...DEFAULT_CONFIG.comparison,
        ...userConfig.comparison,
      },
    } as VisualTestConfig
  } catch (error) {
    throw new Error(`Failed to parse ${CONFIG_FILE_NAME}: ${error}`)
  }
}

/**
 * Validate configuration
 */
export function validateConfig(config: VisualTestConfig): void {
  if (!config.storybook?.port) {
    throw new Error('storybook.port is required')
  }

  if (!config.simulator?.device) {
    throw new Error('simulator.device is required')
  }

  if (!config.comparison?.threshold || config.comparison.threshold < 0 || config.comparison.threshold > 1) {
    throw new Error('comparison.threshold must be between 0 and 1')
  }
}
