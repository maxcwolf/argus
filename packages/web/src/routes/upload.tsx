import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb, tests, storyResults } from '../db'

interface UploadPayload {
  branch: string
  baseBranch?: string
  commitHash: string
  commitMessage?: string
  stories: Array<{
    storyId: string
    componentName: string
    storyName: string
    baselineUrl?: string
    currentUrl: string
    diffUrl?: string
    pixelDiff: number
    ssimScore: number
    hasDiff: boolean
    isNew: boolean
  }>
}

// Exported server function for uploading test results
export const uploadTestResults = createServerFn({ method: 'POST' })
  .inputValidator((data: UploadPayload) => data)
  .handler(async ({ data }) => {
    const db = getDb()

    const {
      branch,
      baseBranch = 'main',
      commitHash,
      commitMessage,
      stories,
    } = data

    // Calculate counts
    const totalStories = stories.length
    const changedCount = stories.filter((s) => s.hasDiff || s.isNew).length
    const passedCount = stories.filter((s) => !s.hasDiff && !s.isNew).length
    const failedCount = stories.filter((s) => s.hasDiff).length

    // Create test record
    const [test] = await db
      .insert(tests)
      .values({
        branch,
        baseBranch,
        commitHash,
        commitMessage,
        status: 'PENDING',
        totalStories,
        changedCount,
        passedCount,
        failedCount,
      })
      .returning()

    // Create story results
    if (stories.length > 0) {
      await db.insert(storyResults).values(
        stories.map((story) => ({
          testId: test.id,
          storyId: story.storyId,
          componentName: story.componentName,
          storyName: story.storyName,
          baselineUrl: story.baselineUrl,
          currentUrl: story.currentUrl,
          diffUrl: story.diffUrl,
          pixelDiff: story.pixelDiff,
          ssimScore: story.ssimScore,
          hasDiff: story.hasDiff,
          isNew: story.isNew,
        }))
      )
    }

    return {
      success: true,
      testId: test.id,
      url: `/tests/${test.id}`,
    }
  })

export const Route = createFileRoute('/upload')({
  component: UploadPage,
})

function UploadPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Upload API</h1>
      <p className="text-gray-600 mb-4">
        This endpoint accepts test results from the CLI tool.
      </p>
      <div className="bg-gray-100 rounded-lg p-4">
        <h2 className="font-semibold mb-2">Usage</h2>
        <p className="text-sm text-gray-600 mb-2">
          The CLI uses server functions to upload results. Run:
        </p>
        <code className="block bg-gray-800 text-green-400 p-3 rounded text-sm">
          rn-visual-test upload --api-url http://localhost:3000
        </code>
      </div>
    </div>
  )
}
