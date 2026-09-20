import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class CancelOrderDto {
  @ApiPropertyOptional({ default: false, description: '是否按已付款净额自动生成退款记录' })
  @IsOptional() @IsBoolean() refund: boolean = false

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
