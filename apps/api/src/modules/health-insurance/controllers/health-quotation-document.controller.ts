import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../auth/decorators/current-user.decorator';
import { HealthQuotationDocumentService } from '../services/health-quotation-document.service';
import { AttachHealthDocumentDto, VerifyHealthDocumentDto } from '../dto/health-quotation-case.dto';

@ApiTags('Health Quotation Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('health')
export class HealthQuotationDocumentController {
  constructor(private readonly documentService: HealthQuotationDocumentService) {}

  @Post('quotation-cases/:id/documents')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Attach an uploaded file to a Health case or quote',
    description: 'Upload the file first with POST /documents/upload (entityType QUOTATION or CONTACT), then attach it here.',
  })
  attachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachHealthDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentService.attachDocument(id, dto, user);
  }

  @Get('quotation-cases/:id/documents')
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({ summary: 'Document checklist for the case (Section C) with upload / verification status' })
  getChecklist(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.documentService.getChecklist(id, user);
  }

  @Post('quotation-documents/:id/verify')
  @Roles(RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({ summary: 'Verify or reject a Health document (Back Office / Admin)' })
  verifyDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyHealthDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentService.verifyDocument(id, dto, user);
  }

  @Delete('quotation-documents/:id')
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({ summary: 'Remove a document from a Health case / quote' })
  removeDocument(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.documentService.removeDocument(id, user);
  }
}
