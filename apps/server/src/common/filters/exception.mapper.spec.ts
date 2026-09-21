import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { mapException } from './exception.mapper'

describe('mapException', () => {
  it('P2002 → 409 CONFLICT', () => {
    const error = new Prisma.PrismaClientKnownRequestError('unique failed', {
      code: 'P2002',
      clientVersion: '7.10.0',
    })
    expect(mapException(error)).toEqual({ statusCode: 409, code: 'CONFLICT', message: '数据已存在' })
  })

  it('P2025 → 404 NOT_FOUND', () => {
    const error = new Prisma.PrismaClientKnownRequestError('not found', {
      code: 'P2025',
      clientVersion: '7.10.0',
    })
    expect(mapException(error)).toEqual({ statusCode: 404, code: 'NOT_FOUND', message: '记录不存在' })
  })

  it('P2003 → 400 FOREIGN_KEY_VIOLATION', () => {
    const error = new Prisma.PrismaClientKnownRequestError('fk failed', {
      code: 'P2003',
      clientVersion: '7.10.0',
    })
    expect(mapException(error)).toEqual({
      statusCode: 400,
      code: 'FOREIGN_KEY_VIOLATION',
      message: '关联数据不合法',
    })
  })

  it('未知 Prisma 错误 → 400', () => {
    const error = new Prisma.PrismaClientKnownRequestError('weird', {
      code: 'P9999',
      clientVersion: '7.10.0',
    })
    expect(mapException(error).statusCode).toBe(400)
    expect(mapException(error).code).toBe('PRISMA_P9999')
  })

  it.each(['P2028', 'P2024', 'P1001', 'P1002'])(
    '%s（事务/连接类失败）→ 503 DATABASE_UNAVAILABLE',
    code => {
      const error = new Prisma.PrismaClientKnownRequestError('database busy', {
        code,
        clientVersion: '7.10.0',
      })
      expect(mapException(error).statusCode).toBe(503)
      expect(mapException(error).code).toBe('DATABASE_UNAVAILABLE')
    },
  )

  it('带 code 的 HttpException 原样保留', () => {
    const error = new BadRequestException({
      statusCode: 400,
      code: 'INVALID_PAYMENT',
      message: '付款节点不合法',
    })
    expect(mapException(error)).toEqual({
      statusCode: 400,
      code: 'INVALID_PAYMENT',
      message: '付款节点不合法',
    })
  })

  it('无 code 的 HttpException 回退为状态枚举名', () => {
    expect(mapException(new NotFoundException('订单不存在'))).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: '订单不存在',
    })
  })

  it('普通 Error → 500 INTERNAL_ERROR', () => {
    expect(mapException(new Error('boom'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    })
  })
})
