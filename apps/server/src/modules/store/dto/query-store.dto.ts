import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsUUID } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto'

export class QueryStoreDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '按平台过滤' })
  @IsOptional()
  @IsUUID()
  platformId?: string

  @ApiPropertyOptional({ description: '关键词：店铺名称' })
  @IsOptional()
  @IsString()
  keyword?: string
}
