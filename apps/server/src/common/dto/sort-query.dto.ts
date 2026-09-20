import { IsIn, IsOptional, IsString } from 'class-validator'

export class SortOrderQueryDto {
  @IsOptional()
  @IsString()
  sortBy?: string

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc'
}
