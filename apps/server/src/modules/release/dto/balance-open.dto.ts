import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator'

export const BALANCE_OPEN_PAYMENT_TYPES = ['BALANCE', 'INSTALLMENT', 'OTHER'] as const

export type BalanceOpenPaymentType = (typeof BALANCE_OPEN_PAYMENT_TYPES)[number]

export class BalanceOpenDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() paymentId?: string
  @ApiPropertyOptional({ enum: BALANCE_OPEN_PAYMENT_TYPES, description: '未传 paymentId 时按类型定位待付款节点' })
  @IsOptional() @IsIn(BALANCE_OPEN_PAYMENT_TYPES) paymentType?: BalanceOpenPaymentType
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
