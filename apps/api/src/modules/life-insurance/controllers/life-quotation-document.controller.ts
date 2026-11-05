import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DocumentVerificationStatus, LifeDocumentType, RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../auth/decorators/current-user.decorator';
import {
  AttachLifeDocumentDto,
  LifeQuotationDocumentService,
  VerifyLifeDocumentDto,
} from '../services/life-quotation-document.service';

class AttachDocumentBodyDto implements AttachLifeDocumentDto {
  documentId: string;
  documentType: LifeDocumentType;
  quotationId?: string;
}

class VerifyDocumentBodyDto implements VerifyLifeDocumentDto {
  verificationStatus: DocumentVerificationStatus;
  rejectionReason?: string;
}

@ApiTags('Life Quotation Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('life/quotation-cases')
export class LifeQuotationDocumentController {
  constructor(private readonly documentService: LifeQuotationDocumentService) {}

  @Post(':caseId/documents')
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Attach an uploaded file to a Life proposal case or specific quote' })
  @ApiResponse({ status: 201, description: 'Document linked to proposal case.' })
  attachDocument(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: AttachDocumentBodyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentService.attachDocument(caseId, dto, user);
  }

  @Get(':caseId/documents')
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({ summary: 'List all documents attached to a Life proposal case' })
  getCaseDocuments(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentService.getCaseDocuments(caseId, user);
  }

  @Get(':caseId/documents/checklist')
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({ summary: 'Evaluate IRDAI checklist compliance: required vs uploaded documents' })
  evaluateChecklist(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentService.evaluateChecklist(caseId, user);
  }

  @Patch('documents/:documentRecordId/verify')
  @Roles(RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({ summary: 'Verify or reject a document (Back Office & Admin only)' })
  verifyDocument(
    @Param('documentRecordId', ParseUUIDPipe) documentRecordId: string,
    @Body() dto: VerifyDocumentBodyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentService.verifyDocument(documentRecordId, dto, user);
  }
}

