import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import { CalendarService } from './calendar.service'
import { CalendarRangeDto } from './dto/calendar-query.dto'
import type { CalendarEventVo } from './mapper/calendar.mapper'

@ApiTags('calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  events(
    @CurrentUser() user: AuthUser,
    @Query() query: CalendarRangeDto,
  ): Promise<CalendarEventVo[]> {
    return this.calendarService.getEvents(user.id, query.from, query.to)
  }
}
