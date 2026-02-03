import type { Plugin } from 'vite'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createReadStream, existsSync, statSync } from 'fs'
import { extname } from 'path'
import * as schema from './db/schema'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

/**
 * Vite plugin to add API endpoints for the CLI
 */
export function apiPlugin(): Plugin {
  let db: ReturnType<typeof drizzle> | null = null

  return {
    name: 'api-plugin',
    configureServer(server) {
      // Initialize database connection
      const connectionString = process.env.DATABASE_URL
      if (connectionString) {
        const client = postgres(connectionString)
        db = drizzle(client, { schema })
      }

      // Add middleware for API routes
      server.middlewares.use(async (req, res, next) => {
        // Image serving endpoint
        if (req.url?.startsWith('/api/images') && req.method === 'GET') {
          const url = new URL(req.url, 'http://localhost')
          const filePath = url.searchParams.get('path')

          if (!filePath) {
            res.statusCode = 400
            res.end('Missing path parameter')
            return
          }

          // Security: only allow image files
          const ext = extname(filePath).toLowerCase()
          if (!MIME_TYPES[ext]) {
            res.statusCode = 400
            res.end('Invalid file type')
            return
          }

          // Check if file exists
          if (!existsSync(filePath)) {
            res.statusCode = 404
            res.end('File not found')
            return
          }

          try {
            const stat = statSync(filePath)
            res.setHeader('Content-Type', MIME_TYPES[ext])
            res.setHeader('Content-Length', stat.size)
            res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
            createReadStream(filePath).pipe(res)
          } catch (error) {
            console.error('Error serving image:', error)
            res.statusCode = 500
            res.end('Error serving image')
          }
          return
        }

        if (req.url === '/api/upload' && req.method === 'POST') {
          if (!db) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Database not configured' }))
            return
          }

          let body = ''
          req.on('data', (chunk) => {
            body += chunk.toString()
          })

          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const {
                branch,
                baseBranch = 'main',
                commitHash,
                commitMessage,
                stories = [],
              } = data

              // Validate required fields
              if (!branch || !commitHash) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing required fields: branch, commitHash' }))
                return
              }

              // Calculate counts
              const totalStories = stories.length
              const changedCount = stories.filter((s: any) => s.hasDiff || s.isNew).length
              const passedCount = stories.filter((s: any) => !s.hasDiff && !s.isNew).length
              const failedCount = stories.filter((s: any) => s.hasDiff).length

              // Create test record
              const [test] = await db
                .insert(schema.tests)
                .values({
                  branch,
                  baseBranch,
                  commitHash,
                  commitMessage,
                  status: 'PENDING',
                  totalStories,
                  changedCount,
                  passedCount,
                  failedCount,
                })
                .returning()

              // Create story results
              if (stories.length > 0) {
                await db.insert(schema.storyResults).values(
                  stories.map((story: any) => ({
                    testId: test.id,
                    storyId: story.storyId,
                    kind: story.kind || story.title || null, // Full path like "UI/Button"
                    componentName: story.componentName,
                    storyName: story.storyName,
                    baselineUrl: story.baselineUrl || null,
                    currentUrl: story.currentUrl,
                    diffUrl: story.diffUrl || null,
                    pixelDiff: story.pixelDiff,
                    ssimScore: story.ssimScore,
                    hasDiff: story.hasDiff,
                    isNew: story.isNew,
                  }))
                )
              }

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                success: true,
                testId: test.id,
                url: `/tests/${test.id}`,
              }))
            } catch (error) {
              console.error('Upload error:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Failed to upload test results' }))
            }
          })
          return
        }

        next()
      })
    },
  }
}
