import { ApiProperty } from '@nestjs/swagger'
import { IsISO8601 } from 'class-validator'

export class CalendarRangeDto {
  @ApiProperty({ example: '2027-05-01', description: '起始日期（含）' })
  @IsISO8601() from!: string

  @ApiProperty({ example: '2027-05-31', description: '结束日期（含）' })
  @IsISO8601() to!: string
}
