import { CheckCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Story } from '../../hooks/useStoryTree'

interface StoryFlatListProps {
  stories: Story[]
  selectedStoryId: string | null
  onSelectStory: (storyId: string) => void
  className?: string
}

export function StoryFlatList({
  stories,
  selectedStoryId,
  onSelectStory,
  className,
}: StoryFlatListProps) {
  if (stories.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
        No stories match your filters
      </div>
    )
  }

  return (
    <ul className={cn('divide-y divide-gray-200 dark:divide-gray-700', className)}>
      {stories.map((story) => (
        <li
          key={story.id}
          onClick={() => onSelectStory(story.id)}
          className={cn(
            'px-4 py-3 cursor-pointer transition-colors',
            'hover:bg-gray-50 dark:hover:bg-gray-700',
            selectedStoryId === story.id && 'bg-primary-50 dark:bg-primary-900/30'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {story.componentName}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {story.storyName}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              {story.isNew && (
                <span className="px-2 py-0.5 bg-info-100 text-info-700 dark:bg-info-900 dark:text-info-200 text-xs rounded-full">
                  New
                </span>
              )}
              {story.hasDiff && (
                <span className="px-2 py-0.5 bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-200 text-xs rounded-full">
                  {story.pixelDiff.toFixed(1)}%
                </span>
              )}
              {!story.hasDiff && !story.isNew && (
                <CheckCircle className="w-4 h-4 text-success-500" />
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
