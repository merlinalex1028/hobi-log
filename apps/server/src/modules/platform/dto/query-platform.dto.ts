import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto'

export class QueryPlatformDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '关键词：平台名称' })
  @IsOptional()
  @IsString()
  keyword?: string
}
