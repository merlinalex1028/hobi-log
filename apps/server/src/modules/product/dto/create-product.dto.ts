import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator'
import { PRODUCT_CATEGORIES } from '@hobilog/shared'

export class CreateProductDto {
  @ApiProperty({ example: '芙宁娜 1/7' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originalName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverUrl?: string

  @ApiPropertyOptional({ enum: PRODUCT_CATEGORIES, default: 'OTHER' })
  @IsOptional()
  @IsIn(PRODUCT_CATEGORIES)
  category: string = 'OTHER'

  @ApiPropertyOptional() @IsOptional() @IsString() ipName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() characterName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() manufacturer?: string
  @ApiPropertyOptional() @IsOptional() @IsString() seriesName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() scale?: string
  @ApiPropertyOptional() @IsOptional() @IsString() version?: string
  @ApiPropertyOptional() @IsOptional() @IsString() sku?: string

  @ApiPropertyOptional({ example: 1299 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  officialPrice?: number

  @ApiPropertyOptional({ example: 'CNY' })
  @IsOptional()
  @IsString()
  officialCurrency?: string

  @ApiPropertyOptional({ example: '2027-05-01' })
  @IsOptional()
  @IsISO8601()
  announcedAt?: string

  @ApiPropertyOptional({ example: '2027-05-01' })
  @IsOptional()
  @IsISO8601()
  originalReleaseDate?: string

  @ApiPropertyOptional({ enum: ['DAY', 'MONTH'] })
  @IsOptional()
  @IsIn(['DAY', 'MONTH'])
  releaseDatePrecision?: string

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagNames?: string[]
}
