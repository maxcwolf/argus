import type { SessionOptions } from 'iron-session'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { getIronSession } from 'iron-session'

export interface SessionData {
  userId?: string
  oauthState?: string
  returnTo?: string
}

export const SESSION_OPTIONS: SessionOptions = {
  cookieName: 'argus-session',
  password: process.env.SESSION_SECRET || 'default-secret-must-be-at-least-32-characters-long',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

export function getSession(req: IncomingMessage, res: ServerResponse) {
  return getIronSession<SessionData>(req, res, SESSION_OPTIONS)
}
