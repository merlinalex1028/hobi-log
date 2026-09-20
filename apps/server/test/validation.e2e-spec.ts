import { Controller, Get, INestApplication, Query } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { PaginationQueryDto } from '../src/common/dto/pagination-query.dto'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { createValidationPipe } from '../src/common/pipes/create-validation-pipe'

@Controller('probe')
class ProbeController {
  @Get()
  probe(@Query() query: PaginationQueryDto): PaginationQueryDto {
    return query
  }
}

describe('ValidationPipe + PaginationQueryDto (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile()
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(createValidationPipe())
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('无参数时返回默认分页值', async () => {
    const res = await request(app.getHttpServer()).get('/probe')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ page: 1, pageSize: 20 })
  })

  it('page=0 返回 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer()).get('/probe?page=0')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: expect.any(String),
    })
  })

  it('pageSize 超过上限返回 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer()).get('/probe?pageSize=500')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_FAILED')
  })

  it('未声明参数返回 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer()).get('/probe?unknown=1')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_FAILED')
  })
})
