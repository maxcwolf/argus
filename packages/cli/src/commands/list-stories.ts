import ora from 'ora'
import { loadConfig, validateConfig } from '../utils/config'
import { logger } from '../utils/logger'
import { getAllStories } from '../storybook/parser'

export interface ListStoriesOptions {
  json?: boolean
}

/**
 * List all stories in the project
 */
export async function listStoriesCommand(options: ListStoriesOptions = {}): Promise<void> {
  const spinner = ora('Loading configuration...').start()

  try {
    // Load and validate config
    const config = loadConfig()
    validateConfig(config)
    spinner.succeed('Configuration loaded')

    // Parse story files
    spinner.start('Parsing story files...')
    const stories = await getAllStories(process.cwd(), config.storybook.storiesPattern || 'src/**/*.stories.tsx')
    spinner.succeed(`Found ${stories.length} stories`)

    if (options.json) {
      console.log(JSON.stringify(stories, null, 2))
    } else {
      // Group by component
      const byComponent: Record<string, typeof stories> = {}
      for (const story of stories) {
        const key = story.title || story.componentName
        if (!byComponent[key]) {
          byComponent[key] = []
        }
        byComponent[key].push(story)
      }

      // Display
      console.log('')
      for (const [component, componentStories] of Object.entries(byComponent)) {
        console.log(`📁 ${component}`)
        for (const story of componentStories) {
          console.log(`   └─ ${story.storyName} (${story.id})`)
        }
      }
      console.log('')
      logger.info(`Total: ${stories.length} stories in ${Object.keys(byComponent).length} components`)
    }
  } catch (error) {
    spinner.fail('Failed to list stories')
    throw error
  }
}
