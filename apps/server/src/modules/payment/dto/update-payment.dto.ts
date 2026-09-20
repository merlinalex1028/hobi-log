import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsISO8601, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { PAYMENT_STATUSES, PAYMENT_TYPES } from '@hobilog/shared'
import type { PaymentStatus, PaymentType } from '@hobilog/shared'

export class UpdatePaymentDto {
  @ApiPropertyOptional({ enum: PAYMENT_TYPES }) @IsOptional() @IsIn(PAYMENT_TYPES) type?: PaymentType
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string
  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount?: number | null
  @ApiPropertyOptional({ enum: PAYMENT_STATUSES }) @IsOptional() @IsIn(PAYMENT_STATUSES) status?: PaymentStatus
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() paidAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() paymentMethod?: string
  @ApiPropertyOptional() @IsOptional() @IsString() transactionNo?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number
}
