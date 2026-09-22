import { HttpException, HttpStatus } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import type { ErrorBody } from '../exceptions/business.exception'

const PRISMA_CODE_MAP: Record<string, ErrorBody> = {
  P2002: { statusCode: 409, code: 'CONFLICT', message: '数据已存在' },
  P2025: { statusCode: 404, code: 'NOT_FOUND', message: '记录不存在' },
  P2003: { statusCode: 400, code: 'FOREIGN_KEY_VIOLATION', message: '关联数据不合法' },
  P2028: { statusCode: 503, code: 'DATABASE_UNAVAILABLE', message: '数据库繁忙，请稍后重试' },
  P2024: { statusCode: 503, code: 'DATABASE_UNAVAILABLE', message: '数据库繁忙，请稍后重试' },
  P1001: { statusCode: 503, code: 'DATABASE_UNAVAILABLE', message: '数据库连接不可用' },
  P1002: { statusCode: 503, code: 'DATABASE_UNAVAILABLE', message: '数据库连接不可用' },
}

const DATABASE_ERROR_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT'])
const DATABASE_ERROR_MESSAGES = [
  'Connection terminated unexpectedly',
  'Connection terminated due to connection timeout',
  'timeout exceeded when trying to connect',
]

function toErrorBody(statusCode: number, code: string, message: string): ErrorBody {
  return { statusCode, code, message }
}

export function mapException(exception: unknown): ErrorBody {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      PRISMA_CODE_MAP[exception.code] ??
      toErrorBody(400, `PRISMA_${exception.code}`, '数据库请求失败')
    )
  }

  if (exception instanceof HttpException) {
    const payload: unknown = exception.getResponse()
    if (typeof payload === 'object' && payload !== null && 'code' in payload) {
      return payload as ErrorBody
    }
    return toErrorBody(
      exception.getStatus(),
      HttpStatus[exception.getStatus()] ?? 'ERROR',
      typeof payload === 'string' ? payload : exception.message,
    )
  }

  if (exception instanceof Error) {
    const code = 'code' in exception ? exception.code : undefined
    if (
      (typeof code === 'string' && DATABASE_ERROR_CODES.has(code)) ||
      DATABASE_ERROR_MESSAGES.some(message => exception.message.includes(message))
    ) {
      return toErrorBody(503, 'DATABASE_UNAVAILABLE', '数据库连接不可用')
    }
  }

  return toErrorBody(500, 'INTERNAL_ERROR', '服务器内部错误')
}
