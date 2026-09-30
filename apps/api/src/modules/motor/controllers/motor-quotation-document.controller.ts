import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { MotorQuotationDocumentService } from '../services/motor-quotation-document.service';
import { AttachMotorDocumentDto, VerifyMotorDocumentDto } from '../dto/motor-quotation-document.dto';

@ApiTags('Motor Quotation Documents (V2 Architecture)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('motor')
export class MotorQuotationDocumentController {
  constructor(private readonly documentService: MotorQuotationDocumentService) {}

  @Post('quotations/:id/documents')
  @HttpCode(HttpStatus.CREATED)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Attach document to Motor Quotation',
    description: 'Associates a stored Document with a quotation under a specific Motor document classification.',
  })
  async attachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachMotorDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentService.attachDocument(id, dto, user);
  }

  @Get('quotations/:id/documents')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'List documents attached to a quotation',
    description: 'Returns all motor documents linked to the quotation.',
  })
  async getQuotationDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentService.getQuotationDocuments(id, user);
  }

  @Post('quotation-documents/:id/verify')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Verify or reject a motor quotation document',
    description: 'Records back-office verification decision and timestamp.',
  })
  async verifyDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyMotorDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentService.verifyDocument(id, dto, user);
  }

  @Delete('quotation-documents/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  @ApiOperation({
    summary: 'Remove document association from quotation',
    description: 'Deletes the quotation-document link.',
  })
  async deleteQuotationDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentService.deleteQuotationDocument(id, user);
  }
}