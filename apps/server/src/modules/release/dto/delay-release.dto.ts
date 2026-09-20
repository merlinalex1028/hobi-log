import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsIn, IsOptional, IsString } from 'class-validator'

export class DelayReleaseDto {
  @ApiProperty({ example: '2027-05-01' }) @IsISO8601() newDate!: string
  @ApiPropertyOptional({ enum: ['DAY', 'MONTH'] }) @IsOptional() @IsIn(['DAY', 'MONTH']) precision?: 'DAY' | 'MONTH'
  @ApiPropertyOptional({ description: '不传则自动取当前计划出货日' }) @IsOptional() @IsISO8601() oldDate?: string
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string
  @ApiPropertyOptional() @IsOptional() @IsString() sourceUrl?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
