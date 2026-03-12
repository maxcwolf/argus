import type { Plugin } from 'vite'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createReadStream, existsSync, statSync } from 'fs'
import { extname } from 'path'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import * as schema from './db/schema'
import { getSession } from './auth/session'

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
        // --- OAuth: GET /auth/github ---
        if (req.url?.startsWith('/auth/github') && !req.url?.startsWith('/auth/github/callback') && req.method === 'GET') {
          const clientId = process.env.GITHUB_CLIENT_ID
          if (!clientId) {
            res.statusCode = 500
            res.end('GITHUB_CLIENT_ID not configured')
            return
          }

          const session = await getSession(req, res)
          const state = randomBytes(16).toString('hex')
          session.oauthState = state

          const url = new URL(req.url, 'http://localhost')
          const returnTo = url.searchParams.get('returnTo') || '/'
          session.returnTo = returnTo
          await session.save()

          const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
          const redirectUri = `${baseUrl}/auth/github/callback`

          const githubUrl = new URL('https://github.com/login/oauth/authorize')
          githubUrl.searchParams.set('client_id', clientId)
          githubUrl.searchParams.set('redirect_uri', redirectUri)
          githubUrl.searchParams.set('scope', 'read:user user:email')
          githubUrl.searchParams.set('state', state)

          res.writeHead(302, { Location: githubUrl.toString() })
          res.end()
          return
        }

        // --- OAuth: GET /auth/github/callback ---
        if (req.url?.startsWith('/auth/github/callback') && req.method === 'GET') {
          const url = new URL(req.url, 'http://localhost')
          const code = url.searchParams.get('code')
          const state = url.searchParams.get('state')

          const session = await getSession(req, res)

          if (!code || !state || state !== session.oauthState) {
            res.statusCode = 400
            res.end('Invalid OAuth callback: state mismatch')
            return
          }

          // Clear oauth state
          const returnTo = session.returnTo || '/'
          delete session.oauthState
          delete session.returnTo

          try {
            // Exchange code for access token
            const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
              }),
            })

            const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
            if (!tokenData.access_token) {
              res.statusCode = 400
              res.end(`OAuth token exchange failed: ${tokenData.error || 'unknown error'}`)
              return
            }

            const accessToken = tokenData.access_token

            // Fetch user profile
            const userRes = await fetch('https://api.github.com/user', {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
            const githubUser = await userRes.json() as {
              id: number
              login: string
              name: string | null
              email: string | null
              avatar_url: string
            }

            // Fetch email if not public
            let email = githubUser.email
            if (!email) {
              const emailsRes = await fetch('https://api.github.com/user/emails', {
                headers: { Authorization: `Bearer ${accessToken}` },
              })
              const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>
              const primary = emails.find((e) => e.primary && e.verified)
              email = primary?.email || emails[0]?.email || `${githubUser.id}@github.noreply.com`
            }

            if (!db) {
              res.statusCode = 500
              res.end('Database not configured')
              return
            }

            const githubId = String(githubUser.id)

            // Upsert: find by githubId, then by email, then insert
            let [user] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.githubId, githubId))
              .limit(1)

            if (!user) {
              // Try by email
              ;[user] = await db
                .select()
                .from(schema.users)
                .where(eq(schema.users.email, email))
                .limit(1)

              if (user) {
                // Link existing email user to GitHub
                await db
                  .update(schema.users)
                  .set({
                    githubId,
                    name: githubUser.name || user.name,
                    avatarUrl: githubUser.avatar_url,
                  })
                  .where(eq(schema.users.id, user.id))
              }
            }

            if (!user) {
              // Create new user
              ;[user] = await db
                .insert(schema.users)
                .values({
                  email,
                  name: githubUser.name || githubUser.login,
                  avatarUrl: githubUser.avatar_url,
                  githubId,
                })
                .returning()
            }

            session.userId = user.id
            await session.save()

            res.writeHead(302, { Location: returnTo })
            res.end()
          } catch (error) {
            console.error('OAuth callback error:', error)
            res.statusCode = 500
            res.end('OAuth callback failed')
          }
          return
        }

        // --- POST /auth/logout ---
        if (req.url === '/auth/logout' && req.method === 'POST') {
          const session = await getSession(req, res)
          session.destroy()
          res.writeHead(302, { Location: '/auth/github' })
          res.end()
          return
        }

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
          // API key authentication
          const apiKey = process.env.ARGUS_API_KEY
          if (apiKey) {
            const authHeader = req.headers.authorization
            if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing API key' }))
              return
            }
          }

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

              // Create test record (db is guaranteed non-null by the guard above)
              const [test] = await db!
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
                await db!.insert(schema.storyResults).values(
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
