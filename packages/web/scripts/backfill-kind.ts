/**
 * Backfill script to populate the `kind` field from storyId
 *
 * Run with: npx tsx scripts/backfill-kind.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, isNull } from 'drizzle-orm'
import * as schema from '../src/db/schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL environment variable is required')
  process.exit(1)
}

const client = postgres(connectionString)
const db = drizzle(client, { schema })

/**
 * Reconstruct kind (full path) from storyId
 * e.g., "ui-button--primary" -> "UI/Button"
 * e.g., "components-forms-textinput--default" -> "Components/Forms/TextInput"
 */
function extractKindFromStoryId(storyId: string): string {
  const parts = storyId.split('--')
  if (parts.length === 0) return storyId

  const titlePart = parts[0]
  const segments = titlePart.split('-')

  if (segments.length === 1) {
    // Single segment - just capitalize
    return capitalize(segments[0])
  }

  // Multiple segments - treat all but last as directory path, last as component
  // e.g., ["ui", "button"] -> "UI/Button"
  // e.g., ["components", "forms", "text", "input"] is ambiguous...

  // Heuristic: common directory names are short (ui, components, screens, etc.)
  // We'll assume segments that look like common dirs stay as dirs
  const commonDirs = ['ui', 'components', 'screens', 'forms', 'layout', 'navigation', 'common', 'shared', 'core', 'atoms', 'molecules', 'organisms', 'templates', 'pages']

  const pathParts: string[] = []
  let i = 0

  // Collect directory parts
  while (i < segments.length - 1) {
    if (commonDirs.includes(segments[i].toLowerCase())) {
      pathParts.push(capitalize(segments[i]))
      i++
    } else {
      break
    }
  }

  // If no common dirs found, assume first segment is directory
  if (pathParts.length === 0 && segments.length > 1) {
    pathParts.push(capitalize(segments[0]))
    i = 1
  }

  // Remaining segments form the component name (PascalCase)
  const componentSegments = segments.slice(i)
  const componentName = componentSegments.map(capitalize).join('')

  if (pathParts.length > 0) {
    return [...pathParts, componentName].join('/')
  }

  return componentName
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

async function backfill() {
  console.log('Starting backfill of kind field...\n')

  // Get all story results without kind
  const stories = await db
    .select()
    .from(schema.storyResults)
    .where(isNull(schema.storyResults.kind))

  console.log(`Found ${stories.length} stories without kind field\n`)

  if (stories.length === 0) {
    console.log('Nothing to backfill!')
    await client.end()
    return
  }

  // Group by derived kind to show preview
  const preview = new Map<string, string[]>()
  for (const story of stories) {
    const kind = extractKindFromStoryId(story.storyId)
    if (!preview.has(kind)) {
      preview.set(kind, [])
    }
    preview.get(kind)!.push(story.storyId)
  }

  console.log('Preview of kind mappings:')
  console.log('='.repeat(60))
  for (const [kind, storyIds] of Array.from(preview.entries()).slice(0, 20)) {
    console.log(`  ${kind}`)
    for (const id of storyIds.slice(0, 3)) {
      console.log(`    <- ${id}`)
    }
    if (storyIds.length > 3) {
      console.log(`    ... and ${storyIds.length - 3} more`)
    }
  }
  if (preview.size > 20) {
    console.log(`  ... and ${preview.size - 20} more directories`)
  }
  console.log('='.repeat(60))
  console.log()

  // Update each story
  let updated = 0
  for (const story of stories) {
    const kind = extractKindFromStoryId(story.storyId)

    await db
      .update(schema.storyResults)
      .set({ kind })
      .where(eq(schema.storyResults.id, story.id))

    updated++
    if (updated % 100 === 0) {
      console.log(`Updated ${updated}/${stories.length}...`)
    }
  }

  console.log(`\nBackfill complete! Updated ${updated} stories.`)
  await client.end()
}

backfill().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
