import { useState, useMemo, useCallback, useEffect } from 'react'

export interface Story {
  id: string
  kind: string | null // Full path like "UI/Button"
  componentName: string
  storyName: string
  storyId: string
  hasDiff: boolean
  isNew: boolean
  pixelDiff: number
  ssimScore: number
  baselineUrl: string | null
  currentUrl: string | null
  diffUrl: string | null
}

export interface TreeNode {
  componentName: string
  stories: Story[]
  hasChanges: boolean
  hasNew: boolean
}

export interface GroupedTreeNode {
  directory: string
  components: TreeNode[]
  hasChanges: boolean
  hasNew: boolean
}

export type ViewMode = 'flat' | 'tree' | 'grouped'

const STORAGE_KEY = 'argus-view-mode'
const EXPANDED_KEY = 'argus-expanded-components'

export function useStoryTree(stories: Story[]) {
  // Initialize view mode from localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'flat'
    const stored = localStorage.getItem(STORAGE_KEY)
    return (stored as ViewMode) || 'flat'
  })

  // Initialize expanded state from localStorage
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(EXPANDED_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Persist view mode to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode)
  }, [viewMode])

  // Persist expanded state to localStorage
  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expandedComponents]))
  }, [expandedComponents])

  // Build tree structure grouped by componentName
  const tree = useMemo((): TreeNode[] => {
    const groupedMap = new Map<string, Story[]>()

    for (const story of stories) {
      const existing = groupedMap.get(story.componentName)
      if (existing) {
        existing.push(story)
      } else {
        groupedMap.set(story.componentName, [story])
      }
    }

    return Array.from(groupedMap.entries()).map(([componentName, componentStories]) => ({
      componentName,
      stories: componentStories,
      hasChanges: componentStories.some((s) => s.hasDiff),
      hasNew: componentStories.some((s) => s.isNew),
    }))
  }, [stories])

  // Build grouped tree structure (directory > component > stories)
  const groupedTree = useMemo((): GroupedTreeNode[] => {
    const directoryMap = new Map<string, Map<string, Story[]>>()

    for (const story of stories) {
      // Use kind field if available, otherwise fall back to componentName
      const kindPath = story.kind || story.componentName
      const parts = kindPath.split('/')
      const directory = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Components'
      const componentName = parts[parts.length - 1]

      if (!directoryMap.has(directory)) {
        directoryMap.set(directory, new Map())
      }
      const componentMap = directoryMap.get(directory)!

      if (!componentMap.has(componentName)) {
        componentMap.set(componentName, [])
      }
      componentMap.get(componentName)!.push(story)
    }

    return Array.from(directoryMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([directory, componentMap]) => {
        const components: TreeNode[] = Array.from(componentMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([componentName, componentStories]) => ({
            componentName,
            stories: componentStories,
            hasChanges: componentStories.some((s) => s.hasDiff),
            hasNew: componentStories.some((s) => s.isNew),
          }))

        return {
          directory,
          components,
          hasChanges: components.some((c) => c.hasChanges),
          hasNew: components.some((c) => c.hasNew),
        }
      })
  }, [stories])

  // Toggle a component's expanded state
  const toggleComponent = useCallback((componentName: string) => {
    setExpandedComponents((prev) => {
      const next = new Set(prev)
      if (next.has(componentName)) {
        next.delete(componentName)
      } else {
        next.add(componentName)
      }
      return next
    })
  }, [])

  // Expand all components (and directories in grouped view)
  const expandAll = useCallback(() => {
    const allKeys = new Set<string>()
    // For tree view
    tree.forEach((node) => allKeys.add(node.componentName))
    // For grouped view
    groupedTree.forEach((dir) => {
      allKeys.add(`dir:${dir.directory}`)
      dir.components.forEach((comp) => {
        allKeys.add(`dir:${dir.directory}/${comp.componentName}`)
      })
    })
    setExpandedComponents(allKeys)
  }, [tree, groupedTree])

  // Collapse all components
  const collapseAll = useCallback(() => {
    setExpandedComponents(new Set())
  }, [])

  // Check if a component is expanded
  const isExpanded = useCallback(
    (componentName: string) => expandedComponents.has(componentName),
    [expandedComponents]
  )

  // Auto-expand component (and directory in grouped view) containing a specific story
  const expandToStory = useCallback((storyId: string) => {
    const story = stories.find((s) => s.id === storyId)
    if (story) {
      const kindPath = story.kind || story.componentName
      const parts = kindPath.split('/')
      const directory = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Components'
      const componentName = parts[parts.length - 1]

      setExpandedComponents((prev) => new Set([
        ...prev,
        story.componentName, // For tree view
        `dir:${directory}`, // For grouped view - directory level
        `dir:${directory}/${componentName}`, // For grouped view - component level
      ]))
    }
  }, [stories])

  // Toggle view mode
  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'flat' ? 'tree' : 'flat'))
  }, [])

  return {
    viewMode,
    setViewMode,
    toggleViewMode,
    tree,
    groupedTree,
    expandedComponents,
    toggleComponent,
    expandAll,
    collapseAll,
    isExpanded,
    expandToStory,
  }
}
