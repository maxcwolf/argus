import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Use environment variable for database URL
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.warn('DATABASE_URL not set, database operations will fail')
}

// Create postgres client
const client = connectionString ? postgres(connectionString) : null

// Create drizzle client
export const db = client ? drizzle(client, { schema }) : null

// Helper to ensure db is available
export function getDb() {
  if (!db) {
    throw new Error('Database not configured. Set DATABASE_URL environment variable.')
  }
  return db
}

// Re-export schema
export * from './schema'
