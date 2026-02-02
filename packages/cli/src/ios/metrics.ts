/**
 * Performance metrics collection
 */

export interface PerformanceMetrics {
  renderTime: number // Milliseconds
  memoryUsage?: number // Bytes
  timestamp: number
}

/**
 * Measure render time for a story
 */
export async function measureRenderTime<T>(fn: () => Promise<T>): Promise<{ result: T; renderTime: number }> {
  const startTime = performance.now()
  const result = await fn()
  const endTime = performance.now()

  return {
    result,
    renderTime: Math.round(endTime - startTime),
  }
}

/**
 * Collect metrics for a story capture
 */
export function collectMetrics(renderTime: number): PerformanceMetrics {
  return {
    renderTime,
    timestamp: Date.now(),
  }
}
