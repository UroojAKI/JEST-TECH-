import { Module } from '@nestjs/common';
import { PoliciesModule } from '../policies/policies.module';
import { ReportsModule } from '../platform/reporting/reports.module';
import { ClaimsController } from './controllers/claims.controller';
import { ClaimRepository } from './repositories/claim.repository';
import { ClaimListener } from './events/claim.listener';

// CQRS Commands
import { ReportClaimService } from './services/commands/report-claim.service';
import { UploadClaimDocumentService } from './services/commands/upload-claim-document.service';
import { AssignSurveyorService } from './services/commands/assign-surveyor.service';
import { CloseClaimService } from './services/commands/close-claim.service';
import { ApproveClaimService } from './services/commands/approve-claim.service';
import { SettleClaimService } from './services/commands/settle-claim.service';
import { RejectClaimService } from './services/commands/reject-claim.service';

// CQRS Queries
import { GetClaimsService } from './services/queries/get-claims.service';

// Report Provider
import { ClaimReportProvider } from './providers/claim-report.provider';

@Module({
  imports: [PoliciesModule, ReportsModule],
  controllers: [ClaimsController],
  providers: [
    ClaimRepository,
    ClaimListener,
    // CQRS Commands
    ReportClaimService,
    UploadClaimDocumentService,
    AssignSurveyorService,
    CloseClaimService,
    ApproveClaimService,
    SettleClaimService,
    RejectClaimService,
    // CQRS Queries
    GetClaimsService,
    // Report Provider
    ClaimReportProvider,
  ],
  exports: [
    ClaimRepository,
    GetClaimsService,
    ClaimReportProvider,
    ApproveClaimService,
    SettleClaimService,
    RejectClaimService,
  ],
})
export class ClaimsModule {}
