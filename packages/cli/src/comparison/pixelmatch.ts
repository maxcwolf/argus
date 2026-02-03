import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync } from 'fs'
import { logger } from '../utils/logger'

export interface PixelmatchResult {
  mismatchedPixels: number
  totalPixels: number
  diffPercentage: number
  diffImagePath?: string
}

/**
 * Compare two images using pixelmatch
 */
export async function compareWithPixelmatch(
  baselinePath: string,
  currentPath: string,
  diffPath?: string,
  threshold = 0.1
): Promise<PixelmatchResult> {
  try {
    // Read images
    const baseline = PNG.sync.read(readFileSync(baselinePath))
    const current = PNG.sync.read(readFileSync(currentPath))

    // Ensure images have same dimensions
    if (baseline.width !== current.width || baseline.height !== current.height) {
      throw new Error(
        `Image dimensions don't match: ${baseline.width}x${baseline.height} vs ${current.width}x${current.height}`
      )
    }

    const { width, height } = baseline
    const totalPixels = width * height

    // Create diff image
    const diff = new PNG({ width, height })

    // Compare images
    // diffColor: red for changed pixels
    // alpha: 0 makes unchanged pixels fully transparent (great for overlays)
    const mismatchedPixels = pixelmatch(baseline.data, current.data, diff.data, width, height, {
      threshold,
      includeAA: false,
      alpha: 0,
      diffColor: [255, 0, 0],
      diffColorAlt: [255, 0, 255],
    })

    const diffPercentage = (mismatchedPixels / totalPixels) * 100

    // Save diff image if path provided and differences exist
    let diffImagePath: string | undefined
    if (diffPath && mismatchedPixels > 0) {
      writeFileSync(diffPath, PNG.sync.write(diff))
      diffImagePath = diffPath
      logger.debug(`Diff image saved: ${diffPath}`)
    }

    return {
      mismatchedPixels,
      totalPixels,
      diffPercentage,
      diffImagePath,
    }
  } catch (error) {
    throw new Error(`Pixelmatch comparison failed: ${error}`)
  }
}

/**
 * Check if images are identical
 */
export async function areImagesIdentical(path1: string, path2: string): Promise<boolean> {
  const result = await compareWithPixelmatch(path1, path2)
  return result.mismatchedPixels === 0
}
