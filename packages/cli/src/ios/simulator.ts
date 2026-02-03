import { execaCommand, execa } from 'execa'
import { SimulatorConfig, SIMULATOR_WAIT_TIMEOUT } from '@rn-visual-testing/shared'
import { logger } from '../utils/logger'

export interface SimulatorDevice {
  udid: string
  name: string
  state: string
  isAvailable: boolean
}

/**
 * Find simulator by name (prefers booted devices)
 */
export async function findSimulator(config: SimulatorConfig): Promise<SimulatorDevice | null> {
  try {
    const { stdout } = await execaCommand('xcrun simctl list devices --json')
    const data = JSON.parse(stdout)

    const matchingDevices: SimulatorDevice[] = []

    // Find all matching devices
    for (const [runtime, devices] of Object.entries(data.devices)) {
      for (const device of devices as any[]) {
        if (device.name === config.device && device.isAvailable !== false) {
          matchingDevices.push({
            udid: device.udid,
            name: device.name,
            state: device.state,
            isAvailable: device.isAvailable !== false,
          })
        }
      }
    }

    if (matchingDevices.length === 0) {
      return null
    }

    // Prefer booted device
    const bootedDevice = matchingDevices.find((d) => d.state === 'Booted')
    if (bootedDevice) {
      return bootedDevice
    }

    // Return first available device
    return matchingDevices[0]
  } catch (error) {
    logger.error(`Failed to find simulator: ${error}`)
    return null
  }
}

/**
 * Boot simulator if not already booted
 */
export async function bootSimulator(udid: string): Promise<void> {
  try {
    const { stdout } = await execaCommand(`xcrun simctl list devices --json`)
    const data = JSON.parse(stdout)

    // Find device state
    let deviceState = 'Shutdown'
    for (const [runtime, devices] of Object.entries(data.devices)) {
      for (const device of devices as any[]) {
        if (device.udid === udid) {
          deviceState = device.state
          break
        }
      }
    }

    if (deviceState === 'Booted') {
      logger.info('Simulator already booted')
      return
    }

    logger.info('Booting simulator...')
    await execaCommand(`xcrun simctl boot ${udid}`)

    // Wait for simulator to be ready
    await waitForSimulator(udid, SIMULATOR_WAIT_TIMEOUT)
    logger.success('Simulator booted')
  } catch (error: any) {
    // If already booted, that's fine
    if (error.message?.includes('current state: Booted')) {
      logger.info('Simulator already booted')
      return
    }
    throw new Error(`Failed to boot simulator: ${error}`)
  }
}

/**
 * Wait for simulator to be in Booted state
 */
async function waitForSimulator(udid: string, timeout: number): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const { stdout } = await execaCommand('xcrun simctl list devices --json')
      const data = JSON.parse(stdout)

      for (const [runtime, devices] of Object.entries(data.devices)) {
        for (const device of devices as any[]) {
          if (device.udid === udid && device.state === 'Booted') {
            return
          }
        }
      }
    } catch (error) {
      // Device might not be ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error('Simulator boot timeout')
}

/**
 * Shutdown simulator
 */
export async function shutdownSimulator(udid: string): Promise<void> {
  try {
    const { stdout } = await execaCommand('xcrun simctl list devices --json')
    const data = JSON.parse(stdout)

    let deviceState = 'Shutdown'
    for (const [runtime, devices] of Object.entries(data.devices)) {
      for (const device of devices as any[]) {
        if (device.udid === udid) {
          deviceState = device.state
          break
        }
      }
    }

    if (deviceState === 'Shutdown') {
      logger.info('Simulator already shutdown')
      return
    }

    logger.info('Shutting down simulator...')
    await execaCommand(`xcrun simctl shutdown ${udid}`)
    logger.success('Simulator shutdown')
  } catch (error) {
    logger.warn(`Failed to shutdown simulator: ${error}`)
  }
}

/**
 * Launch app on simulator
 */
export async function launchApp(udid: string, bundleId: string): Promise<void> {
  try {
    logger.info(`Launching app: ${bundleId}`)
    await execaCommand(`xcrun simctl launch ${udid} ${bundleId}`)
    logger.success('App launched')

    // Wait for app to settle
    await new Promise((resolve) => setTimeout(resolve, 3000))
  } catch (error) {
    throw new Error(`Failed to launch app: ${error}`)
  }
}

/**
 * Terminate app on simulator
 */
export async function terminateApp(udid: string, bundleId: string): Promise<void> {
  try {
    await execaCommand(`xcrun simctl terminate ${udid} ${bundleId}`)
    logger.info('App terminated')
  } catch (error) {
    // App might not be running
    logger.debug(`Failed to terminate app: ${error}`)
  }
}

/**
 * Capture screenshot from simulator
 */
export async function captureScreenshot(udid: string, outputPath: string): Promise<void> {
  try {
    // Use array form to avoid shell quoting issues
    await execa('xcrun', ['simctl', 'io', udid, 'screenshot', outputPath])
    logger.debug(`Screenshot saved: ${outputPath}`)
  } catch (error) {
    throw new Error(`Failed to capture screenshot: ${error}`)
  }
}

/**
 * Erase simulator data
 */
export async function eraseSimulator(udid: string): Promise<void> {
  try {
    logger.info('Erasing simulator data...')
    await execaCommand(`xcrun simctl erase ${udid}`)
    logger.success('Simulator erased')
  } catch (error) {
    throw new Error(`Failed to erase simulator: ${error}`)
  }
}

/**
 * Install app on simulator
 */
export async function installApp(udid: string, appPath: string): Promise<void> {
  try {
    logger.info(`Installing app: ${appPath}`)
    await execaCommand(`xcrun simctl install ${udid} "${appPath}"`)
    logger.success('App installed')
  } catch (error) {
    throw new Error(`Failed to install app: ${error}`)
  }
}

/**
 * Check if app is installed
 */
export async function isAppInstalled(udid: string, bundleId: string): Promise<boolean> {
  try {
    const { stdout } = await execaCommand(`xcrun simctl listapps ${udid}`)
    return stdout.includes(bundleId)
  } catch (error) {
    return false
  }
}
