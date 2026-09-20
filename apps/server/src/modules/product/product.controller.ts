import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Paginated } from '@hobilog/shared'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import { CreateProductDto } from './dto/create-product.dto'
import { QueryProductDto } from './dto/query-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import type { ProductVo } from './mapper/product.mapper'
import { ProductService } from './product.service'

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryProductDto,
  ): Promise<Paginated<ProductVo>> {
    return this.productService.list(user.id, query)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto): Promise<ProductVo> {
    return this.productService.create(user.id, dto)
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ProductVo> {
    return this.productService.getDetail(user.id, id)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductVo> {
    return this.productService.update(user.id, id, dto)
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ProductVo> {
    return this.productService.archive(user.id, id)
  }
}
