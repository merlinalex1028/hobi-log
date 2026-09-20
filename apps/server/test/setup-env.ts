import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'

const envCandidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), 'apps/server/.env')]
const envPath = envCandidates.find(candidate => existsSync(candidate))

if (envPath) {
  config({ path: envPath, quiet: true })
}

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/hobilog_test'
process.env.DIRECT_URL ??= 'postgresql://postgres:postgres@localhost:5432/hobilog_test'
process.env.SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_PUBLISHABLE_KEY ??= 'sb_publishable_test'
process.env.SUPABASE_SECRET_KEY ??= 'sb_secret_test'
