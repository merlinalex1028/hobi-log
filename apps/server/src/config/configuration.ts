export interface AppConfig {
  nodeEnv: string
  port: number
  webOrigin: string
  databaseUrl: string
  directUrl: string
  supabaseUrl: string
  supabasePublishableKey: string
  supabaseSecretKey: string
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL as string,
  directUrl: process.env.DIRECT_URL as string,
  supabaseUrl: process.env.SUPABASE_URL as string,
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY as string,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY as string,
})
