import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'
import { PRODUCT_CATEGORIES } from '@hobilog/shared'
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto'

export class QueryProductDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '关键词：名称 / 原名 / SKU' })
  @IsOptional()
  @IsString()
  keyword?: string

  @ApiPropertyOptional({ enum: PRODUCT_CATEGORIES })
  @IsOptional()
  @IsIn(PRODUCT_CATEGORIES)
  category?: string

  @ApiPropertyOptional() @IsOptional() @IsString() ipName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() characterName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() manufacturer?: string

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status?: string
}
