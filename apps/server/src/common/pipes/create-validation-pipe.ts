import { HttpStatus, ValidationPipe } from '@nestjs/common'
import type { ValidationError } from 'class-validator'
import { BusinessException } from '../exceptions/business.exception'

function firstMessage(errors: ValidationError[]): string {
  for (const error of errors) {
    if (error.constraints) {
      const messages = Object.values(error.constraints)
      if (messages.length > 0) {
        return messages[0] ?? '参数不合法'
      }
    }
    if (error.children && error.children.length > 0) {
      return firstMessage(error.children)
    }
  }
  return '参数不合法'
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new BusinessException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', firstMessage(errors)),
  })
}
