import { List, FolderTree, Layers } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ViewMode } from '../../hooks/useStoryTree'

interface ViewModeToggleProps {
  viewMode: ViewMode
  onSetViewMode: (mode: ViewMode) => void
  className?: string
}

export function ViewModeToggle({ viewMode, onSetViewMode, className }: ViewModeToggleProps) {
  const modes: { value: ViewMode; icon: typeof List; title: string }[] = [
    { value: 'flat', icon: List, title: 'Flat list view' },
    { value: 'tree', icon: FolderTree, title: 'Tree view (by component)' },
    { value: 'grouped', icon: Layers, title: 'Grouped view (by directory)' },
  ]

  return (
    <div className={cn('flex items-center rounded-lg bg-gray-100 dark:bg-gray-700 p-1', className)}>
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onSetViewMode(mode.value)}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            viewMode === mode.value
              ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
          title={mode.title}
          aria-label={`Switch to ${mode.title}`}
          aria-pressed={viewMode === mode.value}
        >
          <mode.icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  )
}
