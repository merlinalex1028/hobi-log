import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'
import { SUPPORTED_CURRENCIES } from '@hobilog/shared'

export class CreatePlatformDto {
  @ApiProperty({ example: '淘宝' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string

  @ApiPropertyOptional({ example: 'https://www.taobao.com' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string

  @ApiPropertyOptional() @IsOptional() @IsString() region?: string

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  defaultCurrency?: string

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
