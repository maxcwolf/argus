import { ChevronRight, ChevronDown, CheckCircle, Folder, FolderOpen } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Story, GroupedTreeNode, TreeNode } from '../../hooks/useStoryTree'

interface StoryGroupedTreeProps {
  tree: GroupedTreeNode[]
  selectedStoryId: string | null
  onSelectStory: (storyId: string) => void
  isExpanded: (key: string) => boolean
  toggleComponent: (key: string) => void
  expandAll: () => void
  collapseAll: () => void
  className?: string
}

export function StoryGroupedTree({
  tree,
  selectedStoryId,
  onSelectStory,
  isExpanded,
  toggleComponent,
  expandAll,
  collapseAll,
  className,
}: StoryGroupedTreeProps) {
  if (tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
        No stories match your filters
      </div>
    )
  }

  const allExpanded = tree.every(
    (dir) =>
      isExpanded(`dir:${dir.directory}`) &&
      dir.components.every((comp) => isExpanded(`dir:${dir.directory}/${comp.componentName}`))
  )
  const allCollapsed = tree.every(
    (dir) =>
      !isExpanded(`dir:${dir.directory}`) &&
      dir.components.every((comp) => !isExpanded(`dir:${dir.directory}/${comp.componentName}`))
  )

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

      {/* Directory nodes */}
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {tree.map((dir) => (
          <DirectoryNode
            key={dir.directory}
            node={dir}
            selectedStoryId={selectedStoryId}
            onSelectStory={onSelectStory}
            isExpanded={isExpanded}
            toggleComponent={toggleComponent}
          />
        ))}
      </ul>
    </div>
  )
}

interface DirectoryNodeProps {
  node: GroupedTreeNode
  selectedStoryId: string | null
  onSelectStory: (storyId: string) => void
  isExpanded: (key: string) => boolean
  toggleComponent: (key: string) => void
}

function DirectoryNode({
  node,
  selectedStoryId,
  onSelectStory,
  isExpanded,
  toggleComponent,
}: DirectoryNodeProps) {
  const dirKey = `dir:${node.directory}`
  const expanded = isExpanded(dirKey)
  const ChevronIcon = expanded ? ChevronDown : ChevronRight
  const FolderIcon = expanded ? FolderOpen : Folder

  const totalStories = node.components.reduce((sum, c) => sum + c.stories.length, 0)
  const passedCount = node.components.reduce(
    (sum, c) => sum + c.stories.filter((s) => !s.hasDiff && !s.isNew).length,
    0
  )
  const allPassed = passedCount === totalStories

  return (
    <li>
      {/* Directory header */}
      <button
        onClick={() => toggleComponent(dirKey)}
        className={cn(
          'w-full px-4 py-2 flex items-center gap-2 text-left',
          'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
          'bg-gray-50/50 dark:bg-gray-800/50'
        )}
      >
        <ChevronIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        <FolderIcon className="w-4 h-4 text-primary-500 dark:text-primary-400 flex-shrink-0" />
        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate flex-1">
          {node.directory}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          ({totalStories})
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

      {/* Component children */}
      <div className={cn('tree-content', expanded && 'expanded')}>
        <div>
          <ul>
            {node.components.map((comp) => (
              <ComponentNode
                key={comp.componentName}
                node={comp}
                directory={node.directory}
                selectedStoryId={selectedStoryId}
                onSelectStory={onSelectStory}
                isExpanded={isExpanded(`dir:${node.directory}/${comp.componentName}`)}
                onToggle={() => toggleComponent(`dir:${node.directory}/${comp.componentName}`)}
              />
            ))}
          </ul>
        </div>
      </div>
    </li>
  )
}

interface ComponentNodeProps {
  node: TreeNode
  directory: string
  selectedStoryId: string | null
  onSelectStory: (storyId: string) => void
  isExpanded: boolean
  onToggle: () => void
}

function ComponentNode({
  node,
  selectedStoryId,
  onSelectStory,
  isExpanded,
  onToggle,
}: ComponentNodeProps) {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight
  const passedCount = node.stories.filter((s) => !s.hasDiff && !s.isNew).length
  const allPassed = passedCount === node.stories.length

  return (
    <li>
      {/* Component header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full pl-8 pr-4 py-2 flex items-center gap-2 text-left',
          'hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
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

      {/* Story children */}
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
        'pl-14 pr-4 py-2 cursor-pointer transition-colors',
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
