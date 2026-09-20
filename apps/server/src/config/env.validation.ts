export type AppEnvName = 'development' | 'test' | 'production'

export interface AppEnv {
  NODE_ENV: AppEnvName
  PORT: number
  WEB_ORIGIN: string
  DATABASE_URL: string
  DIRECT_URL: string
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  SUPABASE_SECRET_KEY: string
}

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
] as const

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const missing = REQUIRED_KEYS.filter(key => {
    const value = raw[key]
    return typeof value !== 'string' || value.trim() === ''
  })
  if (missing.length > 0) {
    throw new Error(`MISSING_ENV: ${missing.join(', ')}`)
  }

  const port = raw.PORT === undefined ? 3000 : Number(raw.PORT)
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('INVALID_ENV: PORT')
  }

  return {
    NODE_ENV: (raw.NODE_ENV as AppEnvName | undefined) ?? 'development',
    PORT: port,
    WEB_ORIGIN:
      typeof raw.WEB_ORIGIN === 'string' && raw.WEB_ORIGIN !== ''
        ? raw.WEB_ORIGIN
        : 'http://localhost:5173',
    DATABASE_URL: raw.DATABASE_URL as string,
    DIRECT_URL: raw.DIRECT_URL as string,
    SUPABASE_URL: raw.SUPABASE_URL as string,
    SUPABASE_PUBLISHABLE_KEY: raw.SUPABASE_PUBLISHABLE_KEY as string,
    SUPABASE_SECRET_KEY: raw.SUPABASE_SECRET_KEY as string,
  }
}
