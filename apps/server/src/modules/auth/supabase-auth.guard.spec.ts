import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SupabaseAuthGuard } from './supabase-auth.guard'

function contextWith(
  headers: Record<string, string>,
  handler: () => void = () => undefined,
): ExecutionContext {
  const request: { headers: Record<string, string>; user?: unknown } = { headers }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext
}

describe('SupabaseAuthGuard', () => {
  const build = (isPublic = false) => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(isPublic),
    } as unknown as Reflector
    const supabase = { getUserFromToken: vi.fn().mockResolvedValue({ id: 'u1' }) }
    const profiles = { ensureProfile: vi.fn().mockResolvedValue({ id: 'u1' }) }
    return {
      guard: new SupabaseAuthGuard(reflector, supabase as never, profiles as never),
      supabase,
      profiles,
    }
  }

  it('@Public() 直接放行', async () => {
    const { guard, supabase } = build(true)
    await expect(guard.canActivate(contextWith({}))).resolves.toBe(true)
    expect(supabase.getUserFromToken).not.toHaveBeenCalled()
  })

  it('缺少 Authorization 抛 401', async () => {
    const { guard } = build()
    await expect(guard.canActivate(contextWith({}))).rejects.toMatchObject({ status: 401 })
  })

  it('合法 token 注入 user 并建档', async () => {
    const { guard, profiles } = build()
    const context = contextWith({ authorization: 'Bearer t' })
    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(profiles.ensureProfile).toHaveBeenCalledWith({ id: 'u1' })
    expect(context.switchToHttp().getRequest<{ user?: unknown }>().user).toEqual({ id: 'u1' })
  })

  it('token 非法时冒泡 401', async () => {
    const { guard, supabase } = build()
    supabase.getUserFromToken.mockRejectedValueOnce(
      Object.assign(new Error('bad'), { status: 401 }),
    )
    await expect(
      guard.canActivate(contextWith({ authorization: 'Bearer t' })),
    ).rejects.toMatchObject({ status: 401 })
  })
})
