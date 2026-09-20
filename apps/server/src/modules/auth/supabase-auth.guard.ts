import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator'
import { BusinessException } from '../../common/exceptions/business.exception'
import type { AuthenticatedRequest } from './auth.types'
import { extractBearerToken, SupabaseService } from './supabase.service'
import { UserProfileService } from './user-profile.service'

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly userProfiles: UserProfileService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const rawHeader = request.headers.authorization
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
    const token = extractBearerToken(header)
    if (!token) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', '缺少访问令牌')
    }

    const user = await this.supabase.getUserFromToken(token)
    await this.userProfiles.ensureProfile(user)
    request.user = user
    return true
  }
}
