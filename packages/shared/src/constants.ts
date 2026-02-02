/**
 * Shared constants
 */

export const DEFAULT_CONFIG = {
  storybook: {
    port: 7007,
    storiesPattern: 'src/**/__stories__/**/*.stories.?(ts|tsx|js|jsx)',
  },
  simulator: {
    device: 'iPhone 15 Pro',
    os: 'iOS 17.0',
  },
  comparison: {
    mode: 'threshold' as const,
    threshold: 0.01,
    includeMetrics: true,
  },
  baselineDir: '.visual-baselines',
  screenshotDir: '.visual-screenshots',
}

export const CONFIG_FILE_NAME = '.rn-visual-testing.json'

export const SIMULATOR_WAIT_TIMEOUT = 30000 // 30 seconds
export const STORY_RENDER_TIMEOUT = 5000 // 5 seconds
export const STORYBOOK_CONNECTION_TIMEOUT = 60000 // 60 seconds

export const IMAGE_FORMATS = {
  screenshot: 'png',
  diff: 'png',
}

export const DIFF_THRESHOLD = 0.01 // 1% difference
export const SSIM_THRESHOLD = 0.95 // 95% similarity
