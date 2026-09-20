import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator'

export class CreateStoreDto {
  @ApiProperty({ example: 'XXX手办店' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  platformId?: string

  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) url?: string
  @ApiPropertyOptional() @IsOptional() @IsString() contact?: string
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string
}
