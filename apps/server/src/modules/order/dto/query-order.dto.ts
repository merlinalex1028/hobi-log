import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator'
import { ORDER_STATUSES, PAYMENT_SUMMARY_STATUSES, PRODUCT_CATEGORIES } from '@hobilog/shared'
import type { OrderStatus } from '@hobilog/shared'
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto'

export const ORDER_TABS = [
  'ALL', 'WAITING_PAYMENT', 'PAYMENT_OVERDUE', 'WAITING_RELEASE', 'WAITING_SHIPMENT',
  'IN_TRANSIT', 'SHIPMENT_EXCEPTION', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'ARCHIVED',
] as const
export type OrderTab = (typeof ORDER_TABS)[number]

export class QueryOrderDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ORDER_TABS, default: 'ALL' })
  @IsOptional() @IsIn(ORDER_TABS) tab: OrderTab = 'ALL'

  @ApiPropertyOptional({ description: '关键词：订单号 / 商品名' })
  @IsOptional() @IsString() keyword?: string

  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional() @IsIn(ORDER_STATUSES) status?: OrderStatus

  @ApiPropertyOptional({ enum: PAYMENT_SUMMARY_STATUSES })
  @IsOptional() @IsIn(PAYMENT_SUMMARY_STATUSES) paymentSummaryStatus?: string

  @ApiPropertyOptional() @IsOptional() @IsUUID() platformId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() storeId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() manufacturer?: string
  @ApiPropertyOptional() @IsOptional() @IsString() ipName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() characterName?: string

  @ApiPropertyOptional({ enum: PRODUCT_CATEGORIES })
  @IsOptional() @IsIn(PRODUCT_CATEGORIES) category?: string

  @ApiPropertyOptional({ description: '下单年份，如 2026' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) year?: number

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) priceMin?: number
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) priceMax?: number

  @ApiPropertyOptional({ description: '只看有延期记录的订单' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  delayed?: boolean
}
