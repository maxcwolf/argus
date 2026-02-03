import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  CheckCircle,
  XCircle,
  Clock,
  GitBranch,
  Hash,
  ArrowLeft,
  Check,
  X,
  Eye,
  Layers,
} from 'lucide-react'
import { eq } from 'drizzle-orm'
import { getDb, tests, storyResults } from '../../db'

/**
 * Convert a local file path to an API endpoint URL for serving images
 */
function getImageUrl(path: string | null): string | null {
  if (!path) return null
  // If it's already a URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  // Convert local file path to API endpoint
  return `/api/images?path=${encodeURIComponent(path)}`
}

// Get test details from database
const getTestDetails = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()

    // Get test
    const [test] = await db
      .select()
      .from(tests)
      .where(eq(tests.id, data.id))
      .limit(1)

    if (!test) {
      throw new Error('Test not found')
    }

    // Get story results
    const stories = await db
      .select()
      .from(storyResults)
      .where(eq(storyResults.testId, data.id))

    return {
      test: {
        ...test,
        createdAt: test.createdAt.toISOString(),
      },
      stories: stories.map((s) => ({
        ...s,
        isNew: !s.baselineUrl,
      })),
    }
  })

export const Route = createFileRoute('/tests/$id')({
  component: TestDetail,
  loader: ({ params }) => getTestDetails({ data: { id: params.id } }),
})

type FilterType = 'all' | 'changed' | 'new' | 'passed'

function StatusBadge({ status }: { status: string }) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    PARTIAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  }

  const icons = {
    PENDING: <Clock className="w-4 h-4" />,
    APPROVED: <CheckCircle className="w-4 h-4" />,
    REJECTED: <XCircle className="w-4 h-4" />,
    PARTIAL: <Clock className="w-4 h-4" />,
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.PENDING}`}
    >
      {icons[status as keyof typeof icons]}
      {status}
    </span>
  )
}

function ImageCompare({
  baseline,
  current,
  diff,
}: {
  baseline: string | null
  current: string
  diff: string | null
}) {
  const [view, setView] = useState<'side-by-side' | 'diff' | 'overlay' | 'current'>(
    'side-by-side'
  )
  const [overlayOpacity, setOverlayOpacity] = useState(0.5)

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <button
          onClick={() => setView('side-by-side')}
          className={`px-3 py-1.5 text-sm rounded-md ${
            view === 'side-by-side'
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <Layers className="w-4 h-4 inline mr-1" />
          Side by Side
        </button>
        {diff && (
          <>
            <button
              onClick={() => setView('diff')}
              className={`px-3 py-1.5 text-sm rounded-md ${
                view === 'diff'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <Eye className="w-4 h-4 inline mr-1" />
              Diff Only
            </button>
            <button
              onClick={() => setView('overlay')}
              className={`px-3 py-1.5 text-sm rounded-md ${
                view === 'overlay'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <Layers className="w-4 h-4 inline mr-1" />
              Overlay
            </button>
          </>
        )}
        <button
          onClick={() => setView('current')}
          className={`px-3 py-1.5 text-sm rounded-md ${
            view === 'current'
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Current Only
        </button>

        {view === 'overlay' && diff && (
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300 dark:border-gray-600">
            <span className="text-sm text-gray-500 dark:text-gray-400">Diff Opacity:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400 w-8">{Math.round(overlayOpacity * 100)}%</span>
          </div>
        )}
      </div>

      {view === 'side-by-side' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Baseline
            </div>
            {baseline ? (
              <div className="border dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img
                  src={baseline}
                  alt="Baseline"
                  className="w-full h-auto"
                  onError={(e) => {
                    e.currentTarget.src =
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f3f4f6" width="200" height="200"/><text fill="%239ca3af" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">No baseline</text></svg>'
                  }}
                />
              </div>
            ) : (
              <div className="border dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 h-64 flex items-center justify-center text-gray-400">
                No baseline (new story)
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Current
            </div>
            <div className="border dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
              <img
                src={current}
                alt="Current"
                className="w-full h-auto"
                onError={(e) => {
                  e.currentTarget.src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f3f4f6" width="200" height="200"/><text fill="%239ca3af" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Image not found</text></svg>'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {view === 'diff' && diff && (
        <div>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Difference Highlight
          </div>
          <div className="border dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
            <img
              src={diff}
              alt="Diff"
              className="w-full h-auto"
              onError={(e) => {
                e.currentTarget.src =
                  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f3f4f6" width="200" height="200"/><text fill="%239ca3af" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Diff not available</text></svg>'
              }}
            />
          </div>
        </div>
      )}

      {view === 'overlay' && diff && (
        <div>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Current with Diff Overlay
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(red/magenta areas show differences)</span>
          </div>
          <div className="border dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 relative">
            <img
              src={current}
              alt="Current"
              className="w-full h-auto"
              onError={(e) => {
                e.currentTarget.src =
                  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f3f4f6" width="200" height="200"/><text fill="%239ca3af" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Image not found</text></svg>'
              }}
            />
            <img
              src={diff}
              alt="Diff overlay"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ opacity: overlayOpacity }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        </div>
      )}

      {view === 'current' && (
        <div>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Current Screenshot
          </div>
          <div className="border dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
            <img
              src={current}
              alt="Current"
              className="w-full h-auto"
              onError={(e) => {
                e.currentTarget.src =
                  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f3f4f6" width="200" height="200"/><text fill="%239ca3af" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Image not found</text></svg>'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function TestDetail() {
  const { test, stories } = Route.useLoaderData()
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedStory, setSelectedStory] = useState<string | null>(
    stories[0]?.id || null
  )

  const filteredStories = stories.filter((story) => {
    switch (filter) {
      case 'changed':
        return story.hasDiff
      case 'new':
        return story.isNew
      case 'passed':
        return !story.hasDiff && !story.isNew
      default:
        return true
    }
  })

  const selected = stories.find((s) => s.id === selectedStory)

  const counts = {
    all: stories.length,
    changed: stories.filter((s) => s.hasDiff).length,
    new: stories.filter((s) => s.isNew).length,
    passed: stories.filter((s) => !s.hasDiff && !s.isNew).length,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Results</h1>
              <StatusBadge status={test.status} />
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <GitBranch className="w-4 h-4" />
                {test.branch}
              </span>
              <span className="flex items-center gap-1">
                <Hash className="w-4 h-4" />
                {test.commitHash}
              </span>
            </div>
            {test.commitMessage && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{test.commitMessage}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Approve All
            </button>
            <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2">
              <X className="w-4 h-4" />
              Reject All
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex gap-6">
          {(['all', 'changed', 'new', 'passed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                filter === tab
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span
                className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  filter === tab
                    ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-200'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {counts[tab]}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Story List */}
        <div className="col-span-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white">Stories</h3>
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
              {filteredStories.map((story) => (
                <li
                  key={story.id}
                  onClick={() => setSelectedStory(story.id)}
                  className={`px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    selectedStory === story.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {story.componentName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {story.storyName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {story.isNew && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 text-xs rounded-full">
                          New
                        </span>
                      )}
                      {story.hasDiff && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200 text-xs rounded-full">
                          {story.pixelDiff.toFixed(1)}%
                        </span>
                      )}
                      {!story.hasDiff && !story.isNew && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Image Comparison */}
        <div className="col-span-8">
          {selected ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {selected.componentName} / {selected.storyName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selected.storyId}</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 rounded-md hover:bg-green-200 dark:hover:bg-green-800 flex items-center gap-1 text-sm">
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button className="px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-800 flex items-center gap-1 text-sm">
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>

              {selected.hasDiff && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-yellow-700 dark:text-yellow-300">
                      Pixel Difference:{' '}
                      <strong>{selected.pixelDiff.toFixed(2)}%</strong>
                    </span>
                    <span className="text-yellow-700 dark:text-yellow-300">
                      SSIM Score:{' '}
                      <strong>{(selected.ssimScore * 100).toFixed(1)}%</strong>
                    </span>
                  </div>
                </div>
              )}

              {selected.isNew && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md">
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    This is a new story without a baseline. Approve to set the
                    current screenshot as the baseline.
                  </span>
                </div>
              )}

              <ImageCompare
                baseline={getImageUrl(selected.baselineUrl)}
                current={getImageUrl(selected.currentUrl)!}
                diff={getImageUrl(selected.diffUrl)}
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
              Select a story to view comparison
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
