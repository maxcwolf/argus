import { ChevronRight, ChevronDown, CheckCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Story, TreeNode } from '../../hooks/useStoryTree'

interface StoryTreeProps {
  tree: TreeNode[]
  selectedStoryId: string | null
  onSelectStory: (storyId: string) => void
  isExpanded: (componentName: string) => boolean
  toggleComponent: (componentName: string) => void
  expandAll: () => void
  collapseAll: () => void
  className?: string
}

export function StoryTree({
  tree,
  selectedStoryId,
  onSelectStory,
  isExpanded,
  toggleComponent,
  expandAll,
  collapseAll,
  className,
}: StoryTreeProps) {
  if (tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
        No stories match your filters
      </div>
    )
  }

  const allExpanded = tree.every((node) => isExpanded(node.componentName))
  const allCollapsed = tree.every((node) => !isExpanded(node.componentName))

  return (
    <div className={className}>
      {/* Expand/Collapse controls */}
      <div className="px-4 py-2 flex items-center gap-2 text-xs border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={expandAll}
          disabled={allExpanded}
          className={cn(
            'text-primary-600 dark:text-primary-400 hover:underline',
            allExpanded && 'opacity-50 cursor-not-allowed'
          )}
        >
          Expand all
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          onClick={collapseAll}
          disabled={allCollapsed}
          className={cn(
            'text-primary-600 dark:text-primary-400 hover:underline',
            allCollapsed && 'opacity-50 cursor-not-allowed'
          )}
        >
          Collapse all
        </button>
      </div>

      {/* Tree nodes */}
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {tree.map((node) => (
          <TreeNodeItem
            key={node.componentName}
            node={node}
            selectedStoryId={selectedStoryId}
            onSelectStory={onSelectStory}
            isExpanded={isExpanded(node.componentName)}
            onToggle={() => toggleComponent(node.componentName)}
          />
        ))}
      </ul>
    </div>
  )
}

interface TreeNodeItemProps {
  node: TreeNode
  selectedStoryId: string | null
  onSelectStory: (storyId: string) => void
  isExpanded: boolean
  onToggle: () => void
}

function TreeNodeItem({
  node,
  selectedStoryId,
  onSelectStory,
  isExpanded,
  onToggle,
}: TreeNodeItemProps) {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight
  const passedCount = node.stories.filter((s) => !s.hasDiff && !s.isNew).length
  const allPassed = passedCount === node.stories.length

  return (
    <li>
      {/* Component header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full px-4 py-2 flex items-center gap-2 text-left',
          'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
        )}
      >
        <ChevronIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        <span className="font-medium text-sm text-gray-900 dark:text-white truncate flex-1">
          {node.componentName}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          ({node.stories.length})
        </span>
        {allPassed && (
          <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0" />
        )}
        {node.hasChanges && !allPassed && (
          <span className="w-2 h-2 rounded-full bg-warning-500 flex-shrink-0" />
        )}
        {node.hasNew && !node.hasChanges && (
          <span className="w-2 h-2 rounded-full bg-info-500 flex-shrink-0" />
        )}
      </button>

      {/* Story children with animation */}
      <div className={cn('tree-content', isExpanded && 'expanded')}>
        <div>
          <ul className="bg-gray-50/50 dark:bg-gray-800/50">
            {node.stories.map((story) => (
              <StoryItem
                key={story.id}
                story={story}
                isSelected={selectedStoryId === story.id}
                onSelect={() => onSelectStory(story.id)}
              />
            ))}
          </ul>
        </div>
      </div>
    </li>
  )
}

interface StoryItemProps {
  story: Story
  isSelected: boolean
  onSelect: () => void
}

function StoryItem({ story, isSelected, onSelect }: StoryItemProps) {
  return (
    <li
      onClick={onSelect}
      className={cn(
        'pl-10 pr-4 py-2 cursor-pointer transition-colors',
        'hover:bg-gray-100 dark:hover:bg-gray-700',
        isSelected && 'bg-primary-50 dark:bg-primary-900/30'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
          {story.storyName}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {story.isNew && (
            <span className="px-1.5 py-0.5 bg-info-100 text-info-700 dark:bg-info-900 dark:text-info-200 text-xs rounded">
              New
            </span>
          )}
          {story.hasDiff && (
            <span className="px-1.5 py-0.5 bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-200 text-xs rounded">
              {story.pixelDiff.toFixed(1)}%
            </span>
          )}
          {!story.hasDiff && !story.isNew && (
            <CheckCircle className="w-3.5 h-3.5 text-success-500" />
          )}
        </div>
      </div>
    </li>
  )
}
