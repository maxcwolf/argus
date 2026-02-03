import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState, useMemo, useCallback } from 'react'
import {
  GitBranch,
  Hash,
  ArrowLeft,
  Check,
  X,
  Menu,
} from 'lucide-react'
import { eq } from 'drizzle-orm'
import { getDb, tests, storyResults } from '../../db'
import { cn, getImageUrl } from '../../lib/utils'
import { useDebounce } from '../../hooks/useDebounce'
import { useStoryTree, type Story, type ViewMode } from '../../hooks/useStoryTree'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Drawer } from '../../components/ui/Drawer'
import { SearchInput } from '../../components/ui/SearchInput'
import { ViewModeToggle } from '../../components/ui/ViewModeToggle'
import { StoryFlatList } from '../../components/story/StoryFlatList'
import { StoryTree } from '../../components/story/StoryTree'
import { StoryGroupedTree } from '../../components/story/StoryGroupedTree'
import { ImageCompare } from '../../components/image/ImageCompare'

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

function TestDetail() {
  const { test, stories: rawStories } = Route.useLoaderData()
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedStory, setSelectedStory] = useState<string | null>(
    rawStories[0]?.id || null
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const debouncedSearch = useDebounce(searchQuery, 150)

  // Memoize stories to prevent infinite re-renders
  const stories: Story[] = useMemo(() =>
    rawStories.map((s) => ({
      id: s.id,
      kind: s.kind,
      componentName: s.componentName,
      storyName: s.storyName,
      storyId: s.storyId,
      hasDiff: s.hasDiff,
      isNew: s.isNew,
      pixelDiff: s.pixelDiff,
      ssimScore: s.ssimScore,
      baselineUrl: s.baselineUrl,
      currentUrl: s.currentUrl,
      diffUrl: s.diffUrl,
    })),
    [rawStories]
  )

  // Filter and search stories
  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      // Apply filter type
      let passesFilter = true
      switch (filter) {
        case 'changed':
          passesFilter = story.hasDiff
          break
        case 'new':
          passesFilter = story.isNew
          break
        case 'passed':
          passesFilter = !story.hasDiff && !story.isNew
          break
      }

      if (!passesFilter) return false

      // Apply search
      if (!debouncedSearch.trim()) return true

      const query = debouncedSearch.toLowerCase()
      return (
        story.componentName.toLowerCase().includes(query) ||
        story.storyName.toLowerCase().includes(query)
      )
    })
  }, [stories, filter, debouncedSearch])

  // Use the story tree hook
  const {
    viewMode,
    setViewMode,
    tree,
    groupedTree,
    toggleComponent,
    expandAll,
    collapseAll,
    isExpanded,
    expandToStory,
  } = useStoryTree(filteredStories)

  // Handle view mode change - expand to selected story when switching to tree/grouped
  const handleSetViewMode = useCallback((mode: ViewMode) => {
    if (viewMode === 'flat' && mode !== 'flat' && selectedStory) {
      // Switching to tree or grouped, expand to show selected story
      expandToStory(selectedStory)
    }
    setViewMode(mode)
  }, [viewMode, selectedStory, expandToStory, setViewMode])

  const selected = stories.find((s) => s.id === selectedStory)

  const counts = {
    all: stories.length,
    changed: stories.filter((s) => s.hasDiff).length,
    new: stories.filter((s) => s.isNew).length,
    passed: stories.filter((s) => !s.hasDiff && !s.isNew).length,
  }

  const handleSelectStory = (storyId: string) => {
    setSelectedStory(storyId)
    setDrawerOpen(false)
  }

  // Story list panel content (shared between sidebar and drawer)
  const StoryListContent = () => (
    <div className="flex flex-col h-full">
      {/* Search and view toggle */}
      <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search stories..."
          resultCount={filteredStories.length}
          showResultCount={!!debouncedSearch.trim()}
        />
        <div className="flex items-center justify-between">
          <ViewModeToggle viewMode={viewMode} onSetViewMode={handleSetViewMode} />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {filteredStories.length} of {stories.length}
          </span>
        </div>
      </div>

      {/* Story list - fills remaining height */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {viewMode === 'flat' && (
          <StoryFlatList
            stories={filteredStories}
            selectedStoryId={selectedStory}
            onSelectStory={handleSelectStory}
          />
        )}
        {viewMode === 'tree' && (
          <StoryTree
            tree={tree}
            selectedStoryId={selectedStory}
            onSelectStory={handleSelectStory}
            isExpanded={isExpanded}
            toggleComponent={toggleComponent}
            expandAll={expandAll}
            collapseAll={collapseAll}
          />
        )}
        {viewMode === 'grouped' && (
          <StoryGroupedTree
            tree={groupedTree}
            selectedStoryId={selectedStory}
            onSelectStory={handleSelectStory}
            isExpanded={isExpanded}
            toggleComponent={toggleComponent}
            expandAll={expandAll}
            collapseAll={collapseAll}
          />
        )}
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Test Results
              </h1>
              <StatusBadge status={test.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <GitBranch className="w-4 h-4" />
                {test.branch}
              </span>
              <span className="flex items-center gap-1">
                <Hash className="w-4 h-4" />
                <span className="font-mono">{test.commitHash}</span>
              </span>
            </div>
            {test.commitMessage && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                {test.commitMessage}
              </p>
            )}
          </div>

          {(counts.changed > 0 || counts.new > 0) && (
            <div className="flex gap-2 flex-shrink-0">
              <button className="px-3 sm:px-4 py-2 bg-success-600 text-white rounded-md hover:bg-success-700 flex items-center gap-2 text-sm">
                <Check className="w-4 h-4" />
                <span className="hidden sm:inline">Approve All</span>
                <span className="sm:hidden">Approve</span>
              </button>
              <button className="px-3 sm:px-4 py-2 bg-error-600 text-white rounded-md hover:bg-error-700 flex items-center gap-2 text-sm">
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Reject All</span>
                <span className="sm:hidden">Reject</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        <nav className="-mb-px flex gap-4 sm:gap-6 min-w-max">
          {(['all', 'changed', 'new', 'passed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                'py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors',
                filter === tab
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span
                className={cn(
                  'ml-2 px-2 py-0.5 rounded-full text-xs',
                  filter === tab
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-200'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                )}
              >
                {counts[tab]}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Mobile story list button */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            'w-full px-4 py-3 rounded-lg border',
            'bg-white dark:bg-gray-800',
            'border-gray-200 dark:border-gray-700',
            'flex items-center justify-between',
            'text-gray-700 dark:text-gray-200'
          )}
        >
          <div className="flex items-center gap-3">
            <Menu className="w-5 h-5 text-gray-400" />
            <span className="font-medium">
              {selected ? `${selected.componentName} / ${selected.storyName}` : 'Select a story'}
            </span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filteredStories.length} stories
          </span>
        </button>
      </div>

      {/* Main Content - Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-stretch">
        {/* Story List - Hidden on mobile, shown in drawer */}
        <div className="hidden lg:block lg:col-span-4 lg:h-[calc(100vh-20rem)]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden h-full flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h3 className="font-medium text-gray-900 dark:text-white">Stories</h3>
            </div>
            <div className="flex-1 min-h-0">
              <StoryListContent />
            </div>
          </div>
        </div>

        {/* Image Comparison - Full width on mobile */}
        <div className="col-span-1 lg:col-span-8 lg:h-[calc(100vh-20rem)]">
          {selected ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 h-full flex flex-col overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 flex-shrink-0">
                <div className="min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                    {selected.componentName} / {selected.storyName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {selected.storyId}
                  </p>
                </div>
                {(selected.hasDiff || selected.isNew) && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button className="px-3 py-1.5 bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-200 rounded-md hover:bg-success-200 dark:hover:bg-success-800 flex items-center gap-1 text-sm transition-colors">
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button className="px-3 py-1.5 bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-200 rounded-md hover:bg-error-200 dark:hover:bg-error-800 flex items-center gap-1 text-sm transition-colors">
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {selected.hasDiff && (
                <div className="mb-4 p-3 bg-warning-50 dark:bg-warning-900/30 border border-warning-200 dark:border-warning-700 rounded-md flex-shrink-0">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-warning-700 dark:text-warning-300">
                      Pixel Difference:{' '}
                      <strong>{selected.pixelDiff.toFixed(2)}%</strong>
                    </span>
                    <span className="text-warning-700 dark:text-warning-300">
                      SSIM Score:{' '}
                      <strong>{(selected.ssimScore * 100).toFixed(1)}%</strong>
                    </span>
                  </div>
                </div>
              )}

              {selected.isNew && (
                <div className="mb-4 p-3 bg-info-50 dark:bg-info-900/30 border border-info-200 dark:border-info-700 rounded-md flex-shrink-0">
                  <span className="text-sm text-info-700 dark:text-info-300">
                    This is a new story without a baseline. Approve to set the
                    current screenshot as the baseline.
                  </span>
                </div>
              )}

              <ImageCompare
                baseline={getImageUrl(selected.baselineUrl)}
                current={getImageUrl(selected.currentUrl)!}
                diff={getImageUrl(selected.diffUrl)}
                className="flex-1 min-h-0"
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
              Select a story to view comparison
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Stories"
      >
        <StoryListContent />
      </Drawer>
    </div>
  )
}
