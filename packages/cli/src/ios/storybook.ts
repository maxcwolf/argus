import WebSocket from 'ws'
import { Story, STORYBOOK_CONNECTION_TIMEOUT, STORY_RENDER_TIMEOUT } from '@argus/shared'
import { logger } from '../utils/logger'

export interface StorybookClient {
  connect: () => Promise<void>
  disconnect: () => void
  getStories: () => Promise<Story[]>
  navigateToStory: (storyId: string) => Promise<void>
  waitForStory: (timeout?: number) => Promise<void>
}

/**
 * Create Storybook WebSocket client
 */
export function createStorybookClient(port: number): StorybookClient {
  let ws: WebSocket | null = null
  const url = `ws://localhost:${port}`

  return {
    async connect() {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Storybook connection timeout'))
        }, STORYBOOK_CONNECTION_TIMEOUT)

        ws = new WebSocket(url)

        ws.on('open', () => {
          clearTimeout(timeout)
          logger.success('Connected to Storybook')
          resolve()
        })

        ws.on('error', (error) => {
          clearTimeout(timeout)
          reject(new Error(`Storybook connection error: ${error.message}`))
        })

        ws.on('close', () => {
          logger.debug('Storybook connection closed')
        })
      })
    },

    disconnect() {
      if (ws) {
        ws.close()
        ws = null
      }
    },

    async getStories() {
      if (!ws) {
        throw new Error('Not connected to Storybook')
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Failed to get stories'))
        }, 10000)

        const messageHandler = (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString())

            if (message.type === 'setStories') {
              clearTimeout(timeout)
              ws?.off('message', messageHandler)

              // Parse stories from Storybook message
              const stories: Story[] = Object.entries(message.stories || {}).map(([id, story]: [string, any]) => ({
                id,
                componentName: story.kind || story.title,
                storyName: story.name || story.story,
                title: story.title || story.kind,
                kind: story.kind || story.title,
              }))

              resolve(stories)
            }
          } catch (error) {
            // Ignore parse errors, wait for correct message
          }
        }

        ws?.on('message', messageHandler)

        // Request stories
        ws?.send(JSON.stringify({ type: 'getStories' }))
      })
    },

    async navigateToStory(storyId: string) {
      if (!ws) {
        throw new Error('Not connected to Storybook')
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Story navigation timeout'))
        }, STORY_RENDER_TIMEOUT)

        const messageHandler = (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString())

            if (message.type === 'storyRendered' && message.storyId === storyId) {
              clearTimeout(timeout)
              ws?.off('message', messageHandler)
              resolve()
            }
          } catch (error) {
            // Ignore parse errors
          }
        }

        ws?.on('message', messageHandler)

        // Navigate to story
        ws?.send(
          JSON.stringify({
            type: 'selectStory',
            storyId,
          })
        )
      })
    },

    async waitForStory(timeout = STORY_RENDER_TIMEOUT) {
      // Wait for story to fully render
      await new Promise((resolve) => setTimeout(resolve, timeout))
    },
  }
}

/**
 * Wait for Storybook server to be ready
 */
export async function waitForStorybookServer(port: number, timeout = 60000): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}`)
      if (response.ok) {
        logger.success('Storybook server is ready')
        return
      }
    } catch (error) {
      // Server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error('Storybook server timeout')
}

/**
 * Parse story ID from component and story name
 */
export function createStoryId(componentName: string, storyName: string): string {
  return `${componentName}-${storyName}`
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}
