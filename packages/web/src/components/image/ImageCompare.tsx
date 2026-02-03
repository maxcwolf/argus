import { useState } from 'react'
import { Eye, Layers } from 'lucide-react'
import { cn } from '../../lib/utils'

type ViewMode = 'side-by-side' | 'diff' | 'overlay' | 'current'

interface ImageCompareProps {
  baseline: string | null
  current: string
  diff: string | null
  className?: string
}

const placeholderSvg = (text: string) =>
  `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f3f4f6" width="200" height="200"/><text fill="%239ca3af" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14">${encodeURIComponent(text)}</text></svg>`

export function ImageCompare({ baseline, current, diff, className }: ImageCompareProps) {
  const [view, setView] = useState<ViewMode>('side-by-side')
  const [overlayOpacity, setOverlayOpacity] = useState(0.5)

  const viewModes: { value: ViewMode; label: string; icon: typeof Eye; showIf?: boolean }[] = [
    { value: 'side-by-side', label: 'Side by Side', icon: Layers },
    { value: 'diff', label: 'Diff Only', icon: Eye, showIf: !!diff },
    { value: 'overlay', label: 'Overlay', icon: Layers, showIf: !!diff },
    { value: 'current', label: 'Current Only', icon: Eye },
  ]

  return (
    <div className={cn('flex flex-col overflow-hidden', className)}>
      {/* View mode buttons */}
      <div className="flex gap-2 mb-4 flex-wrap items-center flex-shrink-0">
        {viewModes.map(
          (mode) =>
            (mode.showIf === undefined || mode.showIf) && (
              <button
                key={mode.value}
                onClick={() => setView(mode.value)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  view === mode.value
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                )}
              >
                <mode.icon className="w-4 h-4 inline mr-1" />
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            )
        )}

        {/* Overlay opacity slider */}
        {view === 'overlay' && diff && (
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300 dark:border-gray-600">
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
              Diff Opacity:
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400 w-8">
              {Math.round(overlayOpacity * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Image content area - fills remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Side by side view */}
        {view === 'side-by-side' && (
          <div className="h-full grid grid-cols-2 gap-4">
            <div className="min-h-0 flex flex-col">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex-shrink-0">
                Baseline
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-center">
                {baseline ? (
                  <img
                    src={baseline}
                    alt="Baseline"
                    className="max-w-full max-h-full object-contain rounded-lg border border-gray-200 dark:border-gray-600"
                    onError={(e) => {
                      e.currentTarget.src = placeholderSvg('No baseline')
                    }}
                  />
                ) : (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg h-48 w-32 flex items-center justify-center text-gray-400 text-sm text-center px-2">
                    No baseline<br />(new story)
                  </div>
                )}
              </div>
            </div>
            <div className="min-h-0 flex flex-col">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex-shrink-0">
                Current
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <img
                  src={current}
                  alt="Current"
                  className="max-w-full max-h-full object-contain rounded-lg border border-gray-200 dark:border-gray-600"
                  onError={(e) => {
                    e.currentTarget.src = placeholderSvg('Image not found')
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Diff only view */}
        {view === 'diff' && diff && (
          <div className="h-full flex flex-col">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex-shrink-0">
              Difference Highlight
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <img
                src={diff}
                alt="Diff"
                className="max-w-full max-h-full object-contain rounded-lg border border-gray-200 dark:border-gray-600"
                onError={(e) => {
                  e.currentTarget.src = placeholderSvg('Diff not available')
                }}
              />
            </div>
          </div>
        )}

        {/* Overlay view */}
        {view === 'overlay' && diff && (
          <div className="h-full flex flex-col">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex-shrink-0">
              Current with Diff Overlay
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                (red/magenta areas show differences)
              </span>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center relative">
              <img
                src={current}
                alt="Current"
                className="max-w-full max-h-full object-contain rounded-lg border border-gray-200 dark:border-gray-600"
                onError={(e) => {
                  e.currentTarget.src = placeholderSvg('Image not found')
                }}
              />
              <img
                src={diff}
                alt="Diff overlay"
                className="absolute max-w-full max-h-full object-contain pointer-events-none rounded-lg"
                style={{ opacity: overlayOpacity }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          </div>
        )}

        {/* Current only view */}
        {view === 'current' && (
          <div className="h-full flex flex-col">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex-shrink-0">
              Current Screenshot
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <img
                src={current}
                alt="Current"
                className="max-w-full max-h-full object-contain rounded-lg border border-gray-200 dark:border-gray-600"
                onError={(e) => {
                  e.currentTarget.src = placeholderSvg('Image not found')
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
