import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsOptional, IsString } from 'class-validator'

export class ReleaseEventDto {
  @ApiPropertyOptional({ description: '实际发生日期，默认今天' }) @IsOptional() @IsISO8601() date?: string
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string
  @ApiPropertyOptional() @IsOptional() @IsString() sourceUrl?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
