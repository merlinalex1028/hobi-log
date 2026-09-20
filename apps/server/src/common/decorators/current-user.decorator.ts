import { createParamDecorator, ExecutionContext, HttpStatus } from '@nestjs/common'
import type { AuthUser, AuthenticatedRequest } from '../../modules/auth/auth.types'
import { BusinessException } from '../exceptions/business.exception'

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.user) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', '未认证请求')
    }
    return request.user
  },
)
