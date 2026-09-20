import { BusinessException } from '../../common/exceptions/business.exception'
import { extractBearerToken, SupabaseService } from './supabase.service'

describe('extractBearerToken', () => {
  it('解析标准 Bearer 头', () => {
    expect(extractBearerToken('Bearer abc.def')).toBe('abc.def')
  })

  it('大小写与多余空格容错', () => {
    expect(extractBearerToken('bearer   abc.def ')).toBe('abc.def')
  })

  it('缺失或格式错误返回 null', () => {
    expect(extractBearerToken(undefined)).toBeNull()
    expect(extractBearerToken('Token abc')).toBeNull()
    expect(extractBearerToken('Bearer')).toBeNull()
  })
})

describe('SupabaseService.getUserFromToken', () => {
  const build = (result: unknown) => {
    const service = new SupabaseService({ get: (key: string) => process.env[key] } as never)
    Object.assign(service, {
      authClient: { auth: { getUser: vi.fn().mockResolvedValue(result) } },
    })
    return service
  }

  it('返回 AuthUser', async () => {
    const service = build({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null })
    await expect(service.getUserFromToken('t')).resolves.toEqual({ id: 'u1', email: 'a@b.com' })
  })

  it('无 user 时抛 401 UNAUTHORIZED', async () => {
    const service = build({ data: { user: null }, error: null })
    await expect(service.getUserFromToken('t')).rejects.toBeInstanceOf(BusinessException)
    await expect(service.getUserFromToken('t')).rejects.toMatchObject({ status: 401 })
  })

  it('返回 error 时抛 401 UNAUTHORIZED', async () => {
    const service = build({ data: { user: null }, error: { message: 'invalid jwt' } })
    await expect(service.getUserFromToken('t')).rejects.toMatchObject({ status: 401 })
  })

  it('无 email 时省略 email 字段', async () => {
    const service = build({ data: { user: { id: 'u9', email: undefined } }, error: null })
    await expect(service.getUserFromToken('t')).resolves.toEqual({ id: 'u9' })
  })
})
