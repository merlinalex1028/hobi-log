import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import type { ReminderVo } from './mapper/notification.mapper'
import { NotificationService } from './notification.service'

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('todos')
  todos(@CurrentUser() user: AuthUser): Promise<ReminderVo[]> {
    return this.notificationService.getTodos(user.id)
  }
}
