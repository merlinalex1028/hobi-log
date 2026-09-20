import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { PAYMENT_MODES, PAYMENT_TYPES, SUPPORTED_CURRENCIES } from '@hobilog/shared'
import type { PaymentMode, PaymentStatus } from '@hobilog/shared'

export class CreateOrderItemDto {
  @ApiProperty() @IsUUID() productId!: string
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantity: number = 1
  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitPrice!: number
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}

export class CreatePaymentDto {
  @ApiProperty({ enum: PAYMENT_TYPES }) @IsIn(PAYMENT_TYPES) type!: string
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string
  @ApiPropertyOptional({ nullable: true, description: 'null 表示金额待定' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount?: number | null
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() paidAt?: string
  @ApiPropertyOptional({ enum: ['PENDING', 'PAID'] }) @IsOptional() @IsIn(['PENDING', 'PAID']) status?: PaymentStatus
  @ApiPropertyOptional() @IsOptional() @IsString() paymentMethod?: string
  @ApiPropertyOptional() @IsOptional() @IsString() transactionNo?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}

export class ExpectedReleaseDto {
  @ApiProperty({ example: '2027-05-01' }) @IsISO8601() date!: string
  @ApiPropertyOptional({ enum: ['DAY', 'MONTH'] }) @IsOptional() @IsIn(['DAY', 'MONTH']) precision?: 'DAY' | 'MONTH'
}

export class CreateOrderDto {
  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[]

  @ApiPropertyOptional() @IsOptional() @IsUUID() platformId?: string
  @ApiPropertyOptional() @IsOptional() @IsUUID() storeId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) orderNo?: string
  @ApiPropertyOptional() @IsOptional() @IsString() orderUrl?: string
  @ApiProperty() @IsISO8601() orderedAt!: string
  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES, default: 'CNY' })
  @IsOptional() @IsIn(SUPPORTED_CURRENCIES) currency: string = 'CNY'

  @ApiPropertyOptional({ default: true, description: '是否用 items 自动计算商品金额' })
  @IsOptional() @IsBoolean() autoCalculateGoodsAmount: boolean = true
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) goodsAmount: number = 0
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) discountAmount: number = 0
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) shippingAmount: number = 0
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) taxAmount: number = 0
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) extraAmount: number = 0

  @ApiProperty({ enum: PAYMENT_MODES }) @IsIn(PAYMENT_MODES) paymentMode!: PaymentMode

  @ApiProperty({ type: [CreatePaymentDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreatePaymentDto)
  payments!: CreatePaymentDto[]

  @ApiPropertyOptional({ type: ExpectedReleaseDto })
  @IsOptional() @ValidateNested() @Type(() => ExpectedReleaseDto) expectedRelease?: ExpectedReleaseDto

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
