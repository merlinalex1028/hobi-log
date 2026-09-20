import { HttpException, HttpStatus } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import type { ErrorBody } from '../exceptions/business.exception'

const PRISMA_CODE_MAP: Record<string, ErrorBody> = {
  P2002: { statusCode: 409, code: 'CONFLICT', message: '数据已存在' },
  P2025: { statusCode: 404, code: 'NOT_FOUND', message: '记录不存在' },
  P2003: { statusCode: 400, code: 'FOREIGN_KEY_VIOLATION', message: '关联数据不合法' },
}

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

  return toErrorBody(500, 'INTERNAL_ERROR', '服务器内部错误')
}
