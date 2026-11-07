import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { LoanFacilityService } from '../services/loan-facility.service';
import { LoanDocumentService } from '../services/loan-document.service';
import { CreateLoanFacilityDto, UpdateLoanFacilityDto } from '../dto/loan-facility.dto';
import { CreateLoanOfferDto, SelectLoanOfferDto } from '../dto/loan-offer.dto';
import { ConfigureLoanAddOnDto } from '../dto/loan-add-on.dto';

@ApiTags('Loans Facilities & Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoanFacilityController {
  constructor(
    private readonly loanFacilityService: LoanFacilityService,
    private readonly loanDocumentService: LoanDocumentService,
  ) {}

  @Post('cases/:caseId/facilities')
  @ApiOperation({ summary: 'Add a loan facility to a case (Term Loan, BT, Top-Up)' })
  async addFacility(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateLoanFacilityDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanFacilityService.addFacility(caseId, dto, actor);
  }

  @Put('facilities/:facilityId')
  @ApiOperation({ summary: 'Update facility parameters' })
  async updateFacility(
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @Body() dto: UpdateLoanFacilityDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanFacilityService.updateFacility(facilityId, dto, actor);
  }

  @Delete('facilities/:facilityId')
  @ApiOperation({ summary: 'Remove a facility from loan case' })
  async removeFacility(
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanFacilityService.removeFacility(facilityId, actor);
  }

  @Post('facilities/:facilityId/offers')
  @ApiOperation({ summary: 'Log a competing lender offer/quote against a facility' })
  async addLenderOffer(
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @Body() dto: CreateLoanOfferDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanFacilityService.addLenderOffer(facilityId, dto, actor);
  }

  @Post('facilities/:facilityId/select-offer')
  @ApiOperation({ summary: 'Select/accept a lender offer for a facility' })
  async selectLenderOffer(
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @Body() dto: SelectLoanOfferDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanFacilityService.selectLenderOffer(facilityId, dto.offerId, actor);
  }

  @Post('facilities/:facilityId/add-ons')
  @ApiOperation({ summary: 'Configure credit life and asset insurance add-ons' })
  async configureAddOn(
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @Body() dto: ConfigureLoanAddOnDto,
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanFacilityService.configureAddOn(facilityId, dto, actor);
  }

  @Post('offers/:offerId/sanction')
  @ApiOperation({ summary: 'Attach formal bank sanction letter to an offer' })
  async uploadSanctionLetter(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() body: { documentId: string },
    @CurrentUser() actor: ActorContext,
  ) {
    return this.loanDocumentService.uploadSanctionLetter(offerId, body.documentId, actor);
  }
}
