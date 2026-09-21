import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../auth/auth.types'
import { AttachmentService } from './attachment.service'
import { CreateAttachmentDto } from './dto/create-attachment.dto'
import { DownloadUrlQueryDto } from './dto/download-url-query.dto'
import { UploadUrlDto } from './dto/upload-url.dto'
import type { AttachmentVo, UploadUrlVo } from './mapper/attachment.mapper'

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('upload-url')
  uploadUrl(@CurrentUser() user: AuthUser, @Body() dto: UploadUrlDto): Promise<UploadUrlVo> {
    return this.attachmentService.createUploadUrl(user.id, dto)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAttachmentDto): Promise<AttachmentVo> {
    return this.attachmentService.create(user.id, dto)
  }

  @Get(':id/url')
  downloadUrl(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: DownloadUrlQueryDto,
  ): Promise<{ signedUrl: string }> {
    return this.attachmentService.createDownloadUrl(user.id, id, query.expiresIn)
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<{ id: string }> {
    return this.attachmentService.remove(user.id, id)
  }
}
