import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getIronSession } from 'iron-session'
import { eq } from 'drizzle-orm'
import { getDb, users } from '../db'
import { SESSION_OPTIONS, type SessionData } from './session'

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const response = new Response()

    const session = await getIronSession<SessionData>(request, response, SESSION_OPTIONS)

    if (!session.userId) {
      return null
    }

    const db = getDb()
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1)

    return user || null
  }
)
