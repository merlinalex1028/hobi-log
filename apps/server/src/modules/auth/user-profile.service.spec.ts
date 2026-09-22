import { UserProfileService } from './user-profile.service'

describe('UserProfileService.ensureProfile', () => {
  it('已存在时直接返回，不写库', async () => {
    const prisma = {
      userProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'u1' }), create: vi.fn() },
    }
    const service = new UserProfileService(prisma as never)
    await expect(service.ensureProfile({ id: 'u1' })).resolves.toEqual({ id: 'u1' })
    expect(prisma.userProfile.create).not.toHaveBeenCalled()
  })

  it('不存在时创建（username 为空）', async () => {
    const prisma = {
      userProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'u2' }),
      },
    }
    const service = new UserProfileService(prisma as never)
    await expect(service.ensureProfile({ id: 'u2', email: 'x@y.com' })).resolves.toEqual({ id: 'u2' })
    expect(prisma.userProfile.create).toHaveBeenCalledWith({
      data: { id: 'u2' },
      select: { id: true },
    })
  })

  it('并发建档撞 P2002 时回读已有行', async () => {
    const conflict = Object.assign(new Error('unique'), { code: 'P2002' })
    const prisma = {
      userProfile: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'u3' }),
        create: vi.fn().mockRejectedValue(conflict),
      },
    }
    const service = new UserProfileService(prisma as never)
    await expect(service.ensureProfile({ id: 'u3' })).resolves.toEqual({ id: 'u3' })
  })

  it('并发请求共享一次建档查询', async () => {
    let resolveFind: ((value: { id: string }) => void) | undefined
    const findUnique = vi.fn().mockImplementation(
      () => new Promise<{ id: string }>(resolve => {
        resolveFind = resolve
      }),
    )
    const prisma = { userProfile: { findUnique, create: vi.fn() } }
    const service = new UserProfileService(prisma as never)

    const first = service.ensureProfile({ id: 'u5' })
    const second = service.ensureProfile({ id: 'u5' })
    expect(findUnique).toHaveBeenCalledTimes(1)
    resolveFind?.({ id: 'u5' })

    await expect(Promise.all([first, second])).resolves.toEqual([{ id: 'u5' }, { id: 'u5' }])
  })

  it('非 P2002 错误继续抛出', async () => {
    const boom = Object.assign(new Error('boom'), { code: 'P1001' })
    const prisma = {
      userProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(boom),
      },
    }
    const service = new UserProfileService(prisma as never)
    await expect(service.ensureProfile({ id: 'u4' })).rejects.toThrow('boom')
  })
})
