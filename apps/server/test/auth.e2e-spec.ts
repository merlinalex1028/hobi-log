import { INestApplication, HttpStatus } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { BusinessException } from '../src/common/exceptions/business.exception'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/database/prisma.service'
import { SupabaseService } from '../src/modules/auth/supabase.service'
import { ProbeController } from './probe.controller'

describe('AuthGuard (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: async () => undefined,
        $disconnect: async () => undefined,
        $queryRaw: async () => [{ '?column?': 1 }],
        userProfile: {
          findUnique: async () => ({ id: 'user-a' }),
          create: async () => ({ id: 'user-a' }),
        },
      })
      .overrideProvider(SupabaseService)
      .useValue({
        admin: {},
        getUserFromToken: async (token: string) => {
          if (token === 'good-token') return { id: 'user-a', email: 'a@hobilog.dev' }
          throw new BusinessException(
            HttpStatus.UNAUTHORIZED,
            'UNAUTHORIZED',
            '令牌无效或已过期',
          )
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('无 token → 401 UNAUTHORIZED', async () => {
    const res = await request(app.getHttpServer()).get('/api/probe/me')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ statusCode: 401, code: 'UNAUTHORIZED', message: '缺少访问令牌' })
  })

  it('token 合法 → 返回当前用户', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/probe/me')
      .set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 'user-a', email: 'a@hobilog.dev' })
  })

  it('token 非法 → 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/probe/me')
      .set('Authorization', 'Bearer bad-token')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: '令牌无效或已过期',
    })
  })

  it('健康检查仍可匿名访问', async () => {
    const res = await request(app.getHttpServer()).get('/api/health')
    expect(res.status).toBe(200)
  })
})
