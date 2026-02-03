import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function for merging Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date string into a human-readable relative time
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

/**
 * Convert a local file path to an API endpoint URL for serving images
 */
export function getImageUrl(path: string | null): string | null {
  if (!path) return null
  // If it's already a URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  // Convert local file path to API endpoint
  return `/api/images?path=${encodeURIComponent(path)}`
}

/**
 * Detect if the current platform uses Cmd (Mac) or Ctrl (Windows/Linux)
 */
export function getModifierKey(): 'Cmd' | 'Ctrl' {
  if (typeof navigator === 'undefined') return 'Ctrl'
  return navigator.platform.toLowerCase().includes('mac') ? 'Cmd' : 'Ctrl'
}

/**
 * Check if a keyboard event has the platform-specific modifier key pressed
 */
export function hasModifierKey(event: KeyboardEvent): boolean {
  if (typeof navigator === 'undefined') return event.ctrlKey
  return navigator.platform.toLowerCase().includes('mac')
    ? event.metaKey
    : event.ctrlKey
}
