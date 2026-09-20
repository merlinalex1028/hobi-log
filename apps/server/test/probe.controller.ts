import { Controller, Get } from '@nestjs/common'
import { CurrentUser } from '../src/common/decorators/current-user.decorator'
import type { AuthUser } from '../src/modules/auth/auth.types'

@Controller('probe')
export class ProbeController {
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user
  }
}
