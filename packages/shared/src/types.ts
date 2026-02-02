/**
 * Core types for visual regression testing
 */

export interface Story {
  id: string
  componentName: string
  storyName: string
  title: string
  kind: string
}

export interface StoryScreenshot {
  storyId: string
  componentName: string
  storyName: string
  filePath: string
  branch: string
  commitHash: string
  timestamp: number
  renderTime?: number
  memoryUsage?: number
}

export interface ComparisonResult {
  storyId: string
  componentName: string
  storyName: string
  baselineUrl: string
  currentUrl: string
  diffUrl?: string
  pixelDiff: number
  ssimScore: number
  hasDiff: boolean
  renderTime?: number
  memoryUsage?: number
}

export interface TestRun {
  id: string
  branch: string
  baseBranch: string
  commitHash: string
  commitMessage?: string
  totalStories: number
  changedCount: number
  passedCount: number
  failedCount: number
  createdAt: Date
  userId: string
}

export interface ComparisonConfig {
  mode: 'strict' | 'threshold'
  threshold: number
  includeMetrics: boolean
}

export interface SimulatorConfig {
  device: string
  os: string
  appScheme?: string
  bundleId?: string
}

export interface StorybookConfig {
  port: number
  storiesPattern?: string
  startCommand?: string
  launchApp?: string
}

export interface VisualTestConfig {
  storybook: StorybookConfig
  simulator: SimulatorConfig
  comparison: ComparisonConfig
  baselineDir: string
  screenshotDir: string
  apiUrl?: string
}

export type TestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIAL'
export type ApprovalDecision = 'APPROVE_ALL' | 'REJECT_ALL' | 'PARTIAL'

export interface Approval {
  id: string
  testId: string
  userId: string
  decision: ApprovalDecision
  comment?: string
  createdAt: Date
}

export interface StoryResult {
  id: string
  testId: string
  storyId: string
  componentName: string
  storyName: string
  baselineUrl: string
  currentUrl: string
  diffUrl?: string
  pixelDiff: number
  ssimScore: number
  hasDiff: boolean
  renderTime?: number
  memoryUsage?: number
  approved?: boolean
}
