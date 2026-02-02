import { readFileSync } from 'fs'
import sharp from 'sharp'
// @ts-ignore - ssim.js doesn't have types
import ssim from 'ssim.js'

export interface SSIMResult {
  score: number // 0-1, where 1 is identical
  mssim: number // Mean SSIM
}

/**
 * Calculate SSIM (Structural Similarity Index) between two images
 */
export async function calculateSSIM(baselinePath: string, currentPath: string): Promise<SSIMResult> {
  try {
    // Load images and convert to raw buffers
    const [baselineBuffer, currentBuffer] = await Promise.all([
      sharp(baselinePath).raw().toBuffer({ resolveWithObject: true }),
      sharp(currentPath).raw().toBuffer({ resolveWithObject: true }),
    ])

    // Ensure images have same dimensions
    if (
      baselineBuffer.info.width !== currentBuffer.info.width ||
      baselineBuffer.info.height !== currentBuffer.info.height
    ) {
      throw new Error('Image dimensions must match for SSIM calculation')
    }

    // Calculate SSIM - ssim.js expects ImageData-like objects
    const result = ssim(
      {
        data: new Uint8ClampedArray(baselineBuffer.data),
        width: baselineBuffer.info.width,
        height: baselineBuffer.info.height,
      },
      {
        data: new Uint8ClampedArray(currentBuffer.data),
        width: currentBuffer.info.width,
        height: currentBuffer.info.height,
      }
    )

    return {
      score: result.mssim,
      mssim: result.mssim,
    }
  } catch (error) {
    throw new Error(`SSIM calculation failed: ${error}`)
  }
}

/**
 * Check if images are similar based on SSIM threshold
 */
export async function areImagesSimilar(
  baselinePath: string,
  currentPath: string,
  threshold = 0.95
): Promise<boolean> {
  const result = await calculateSSIM(baselinePath, currentPath)
  return result.score >= threshold
}
