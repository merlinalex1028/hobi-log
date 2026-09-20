import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class MarkPaidDto {
  @ApiProperty({ description: '实际付款金额' })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) paidAmount!: number

  @ApiPropertyOptional({ description: '付款时间，默认服务器当前时间' })
  @IsOptional() @IsISO8601() paidAt?: string

  @ApiPropertyOptional() @IsOptional() @IsString() paymentMethod?: string
  @ApiPropertyOptional() @IsOptional() @IsString() transactionNo?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string

  @ApiPropertyOptional({ default: true, description: '实付高于计划金额时是否自动创建补差价节点' })
  @IsOptional() @IsBoolean() createSupplement: boolean = true
}
