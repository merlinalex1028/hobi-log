import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class DownloadUrlQueryDto {
  @ApiPropertyOptional({ default: 3600, description: '签名有效期（秒）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(604_800)
  expiresIn: number = 3600
}
