import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn, getModifierKey, hasModifierKey } from '../../lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  resultCount?: number
  showResultCount?: boolean
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search stories...',
  className,
  resultCount,
  showResultCount = false,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const modifierKey = getModifierKey()

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus
      if (hasModifierKey(e) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }

      // Escape to clear and blur
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        e.preventDefault()
        onChange('')
        inputRef.current?.blur()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onChange])

  const handleClear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-20 py-2 text-sm',
            'bg-gray-100 dark:bg-gray-700',
            'border border-transparent',
            'focus:border-primary-500 focus:bg-white dark:focus:bg-gray-800',
            'rounded-lg outline-none transition-colors',
            'text-gray-900 dark:text-white',
            'placeholder:text-gray-500 dark:placeholder:text-gray-400'
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value ? (
            <button
              onClick={handleClear}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-600 rounded">
              {modifierKey}+K
            </kbd>
          )}
        </div>
      </div>
      {showResultCount && value.trim() && resultCount !== undefined && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </div>
      )}
    </div>
  )
}
