import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Min } from 'class-validator'
import { CreatePaymentDto as OrderCreatePaymentDto } from '../../order/dto/create-order.dto'

export class CreatePaymentDto extends OrderCreatePaymentDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number
}
