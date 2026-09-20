import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator'

export class CreateShipmentItemDto {
  @ApiProperty() @IsUUID() orderItemId!: string
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantity: number = 1
}

export class CreateShipmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() carrier?: string
  @ApiPropertyOptional() @IsOptional() @IsString() trackingNo?: string
  @ApiPropertyOptional({ enum: ['WAITING', 'SHIPPED'] })
  @IsOptional() @IsIn(['WAITING', 'SHIPPED']) status?: 'WAITING' | 'SHIPPED'
  @ApiPropertyOptional() @IsOptional() @IsISO8601() shippedAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() estimatedDeliveryAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string

  @ApiProperty({ type: [CreateShipmentItemDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateShipmentItemDto)
  items!: CreateShipmentItemDto[]
}
