import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { SUPPORTED_CURRENCIES } from '@hobilog/shared'

export class RangeQueryDto {
  @ApiPropertyOptional({ description: '起始日期（含），默认一年前' })
  @IsOptional() @IsISO8601() from?: string

  @ApiPropertyOptional({ description: '结束日期（含），默认今天' })
  @IsOptional() @IsISO8601() to?: string

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES, description: '不传则按币种分组返回' })
  @IsOptional() @IsString() currency?: string
}

export class FuturePaymentQueryDto {
  @ApiPropertyOptional({ default: 12, description: '未来月数' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(36) months: number = 12

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES })
  @IsOptional() @IsString() currency?: string
}
