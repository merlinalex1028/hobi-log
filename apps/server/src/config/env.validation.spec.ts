import { validateEnv } from './env.validation'

const validRaw = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hobilog',
  DIRECT_URL: 'postgresql://postgres:postgres@localhost:5432/hobilog',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
}

describe('validateEnv', () => {
  it('缺少 DATABASE_URL 时抛错', () => {
    expect(() => validateEnv({ ...validRaw, DATABASE_URL: '' })).toThrow(
      'MISSING_ENV: DATABASE_URL',
    )
  })

  it('同时缺少多项时全部列出', () => {
    expect(() => validateEnv({})).toThrow(
      'MISSING_ENV: DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY',
    )
  })

  it('提供默认值', () => {
    const env = validateEnv(validRaw)
    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3000)
    expect(env.WEB_ORIGIN).toBe('http://localhost:5173')
  })

  it('保留显式配置', () => {
    const env = validateEnv({ ...validRaw, NODE_ENV: 'test', PORT: '4000' })
    expect(env.NODE_ENV).toBe('test')
    expect(env.PORT).toBe(4000)
  })

  it('PORT 非数字时抛错', () => {
    expect(() => validateEnv({ ...validRaw, PORT: 'abc' })).toThrow('INVALID_ENV: PORT')
  })

  it('缺少 Supabase key 时抛错', () => {
    expect(() => validateEnv({ ...validRaw, SUPABASE_SECRET_KEY: '' })).toThrow(
      'MISSING_ENV: SUPABASE_SECRET_KEY',
    )
  })
})
