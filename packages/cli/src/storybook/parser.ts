import { readFile } from 'fs/promises'
import { glob } from 'glob'
import { join } from 'path'
import { Story } from '@argus-vrt/shared'
import { logger } from '../utils/logger'

/**
 * Parse story files to extract story information
 */
export async function parseStoryFiles(
  projectPath: string,
  pattern: string
): Promise<Story[]> {
  const stories: Story[] = []

  try {
    // Find all story files
    const storyFiles = await glob(pattern, { cwd: projectPath })
    logger.debug(`Found ${storyFiles.length} story files`)

    for (const file of storyFiles) {
      const filePath = join(projectPath, file)
      const content = await readFile(filePath, 'utf-8')

      // Extract stories from file
      const fileStories = extractStoriesFromFile(content, file)
      stories.push(...fileStories)
    }

    logger.debug(`Parsed ${stories.length} total stories`)
    return stories
  } catch (error) {
    logger.error(`Failed to parse story files: ${error}`)
    return []
  }
}

/**
 * Extract story metadata from file content
 */
function extractStoriesFromFile(content: string, filename: string): Story[] {
  const stories: Story[] = []

  // Extract title from meta object
  // Matches: title: 'UI/Button' or title: "UI/Button"
  const titleMatch = content.match(/title:\s*['"]([^'"]+)['"]/i)
  const title = titleMatch ? titleMatch[1] : ''

  if (!title) {
    logger.debug(`No title found in ${filename}`)
    return []
  }

  // Extract component name from title (last part)
  const titleParts = title.split('/')
  const componentName = titleParts[titleParts.length - 1]
  const kind = title

  // Find all exported story objects
  // Matches: export const StoryName: Story = ... or export const StoryName = ...
  const storyExportRegex = /export\s+const\s+(\w+)(?::\s*Story(?:Obj)?(?:<[^>]+>)?)?\s*=/g
  let match

  while ((match = storyExportRegex.exec(content)) !== null) {
    const storyName = match[1]

    // Skip 'meta' and 'default' exports
    if (storyName === 'meta' || storyName === 'default') continue

    // Generate Storybook story ID
    const id = generateStoryId(title, storyName)

    stories.push({
      id,
      componentName,
      storyName,
      title,
      kind,
    })
  }

  return stories
}

/**
 * Generate Storybook-compatible story ID
 * Format: title--storyname (lowercase, spaces to -, slashes to -)
 */
export function generateStoryId(title: string, storyName: string): string {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/\//g, '-')

  const normalizedStory = storyName
    .replace(/([a-z])([A-Z])/g, '$1-$2') // Convert camelCase
    .toLowerCase()
    .replace(/\s+/g, '-')

  return `${normalizedTitle}--${normalizedStory}`
}

/**
 * Get all stories from a project
 */
export async function getAllStories(projectPath: string, pattern: string): Promise<Story[]> {
  return parseStoryFiles(projectPath, pattern)
}
