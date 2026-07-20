import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Ip,
  HttpStatus,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { DocumentService } from '../services/document.service';
import * as express from 'express';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const fileInterceptorOptions = {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (
    req: any,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(
        new BadRequestException(`File type ${file.mimetype} is not allowed`),
        false,
      );
    }
    cb(null, true);
  },
};

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('entityType') entityType: string,
    @Body('entityId', ParseUUIDPipe) entityId: string,
    @Body('category') category: string,
    @Body('expiryDate') expiryDate: string,
    @Body('tags') tags: string,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    const validEntityTypes = ['ACCOUNT', 'LEAD', 'POLICY', 'QUOTATION', 'CLAIM', 'ENDORSEMENT'];
    if (!validEntityTypes.includes(entityType)) {
      throw new BadRequestException(`Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`);
    }

    const parsedTags = tags ? tags.split(',').map((t) => t.trim()) : [];
    const parsedExpiry = expiryDate ? new Date(expiryDate) : undefined;

    return this.documentService.uploadDocument({
      file,
      name,
      entityType,
      entityId,
      uploadedById: user.id,
      category,
      expiryDate: parsedExpiry,
      tags: parsedTags,
      ipAddress,
    });
  }

  @Post(':id/replace')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  async replaceDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    return this.documentService.replaceDocument(id, file, user.id, ipAddress);
  }

  @Get('entity/:entityType/:entityId')
  async getEntityDocuments(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    const validEntityTypes = ['ACCOUNT', 'LEAD', 'POLICY', 'QUOTATION', 'CLAIM', 'ENDORSEMENT'];
    if (!validEntityTypes.includes(entityType)) {
      throw new BadRequestException(`Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`);
    }
    return this.documentService.getEntityDocuments(entityType, entityId);
  }

  @Get(':id')
  async getDocumentDetails(@Param('id') id: string) {
    return this.documentService.getDocumentDetails(id);
  }

  @Delete(':id')
  async deleteDocument(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    await this.documentService.softDeleteDocument(id, user.id, ipAddress);
    return { success: true, message: 'Document soft-deleted' };
  }

  @Post(':id/restore')
  async restoreDocument(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    await this.documentService.restoreDocument(id, user.id, ipAddress);
    return { success: true, message: 'Document restored' };
  }

  @Get(':id/history')
  async getDocumentHistory(@Param('id') id: string) {
    return this.documentService.getAccessLogs(id);
  }

  @Get(':id/download')
  async downloadDocument(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
    @Res() res: express.Response,
  ) {
    const { fileBuffer, originalFileName, mimeType } = await this.documentService.downloadDocument(
      id,
      user.id,
      ipAddress,
    );

    // Sanitize filename to prevent Content-Disposition injection / header injection
    const safe = path
      .basename(originalFileName)
      .replace(/[^\w\s.\-]/g, '_')
      .substring(0, 255);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
    res.status(HttpStatus.OK).send(fileBuffer);
  }
}
