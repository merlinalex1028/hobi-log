import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsOptional, IsString } from 'class-validator'

export class DeliverShipmentDto {
  @ApiPropertyOptional({ description: '签收时间，默认当前时间' }) @IsOptional() @IsISO8601() deliveredAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
