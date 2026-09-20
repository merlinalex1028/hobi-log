import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class RefundPaymentDto {
  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number
  @ApiPropertyOptional() @IsOptional() @IsISO8601() paidAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() paymentMethod?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() markOriginal: boolean = true
}
