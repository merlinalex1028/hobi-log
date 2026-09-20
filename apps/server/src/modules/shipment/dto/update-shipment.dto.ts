import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator'
import { SHIPMENT_STATUSES } from '@hobilog/shared'
import type { ShipmentStatus } from '@hobilog/shared'

export class UpdateShipmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() carrier?: string
  @ApiPropertyOptional() @IsOptional() @IsString() trackingNo?: string
  @ApiPropertyOptional({ enum: SHIPMENT_STATUSES }) @IsOptional() @IsIn(SHIPMENT_STATUSES) status?: ShipmentStatus
  @ApiPropertyOptional() @IsOptional() @IsISO8601() shippedAt?: string
  @ApiPropertyOptional() @IsOptional() @IsISO8601() estimatedDeliveryAt?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
