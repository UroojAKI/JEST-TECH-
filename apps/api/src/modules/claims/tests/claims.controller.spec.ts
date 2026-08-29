import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClaimStatus, RoleType, UserStatus } from '@prisma/client';

import { ClaimsController } from '../controllers/claims.controller';
import { ReportClaimService } from '../services/commands/report-claim.service';
import { UploadClaimDocumentService } from '../services/commands/upload-claim-document.service';
import { AssignSurveyorService } from '../services/commands/assign-surveyor.service';
import { ApproveClaimService } from '../services/commands/approve-claim.service';
import { SettleClaimService } from '../services/commands/settle-claim.service';
import { RejectClaimService } from '../services/commands/reject-claim.service';
import { CloseClaimService } from '../services/commands/close-claim.service';
import { GetClaimsService } from '../services/queries/get-claims.service';
import { ReportClaimDto } from '../dto/report-claim.dto';
import { AssignSurveyorDto } from '../dto/assign-surveyor.dto';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import { PaginationDto } from '../../../common/pagination/pagination.dto';

describe('ClaimsController', () => {
  let controller: ClaimsController;
  let reportClaimService: ReportClaimService;
  let uploadClaimDocumentService: UploadClaimDocumentService;
  let assignSurveyorService: AssignSurveyorService;
  let approveClaimService: ApproveClaimService;
  let settleClaimService: SettleClaimService;
  let rejectClaimService: RejectClaimService;
  let closeClaimService: CloseClaimService;
  let getClaimsService: GetClaimsService;

  const mockUser: RequestUser = {
    id: 'user-123',
    userId: 'user-123',
    email: 'claims_officer@jestpolicy.com',
    role: RoleType.CLAIMS_OFFICER,
    firstName: 'Claims',
    lastName: 'Officer',
    organizationId: 'org-1',
    companyId: 'org-1',
    roles: [RoleType.CLAIMS_OFFICER],
    permissions: ['CLAIMS_READ', 'CLAIMS_WRITE'],
    workspaces: ['OPERATIONS'],
    status: UserStatus.ACTIVE,
  };

  const mockClaimResponse = {
    id: 'claim-123',
    claimNumber: 'CLM-000001',
    status: ClaimStatus.REPORTED,
    policyId: 'policy-123',
    contactId: 'contact-123',
    accountId: null,
    incidentDate: new Date(),
    reportedDate: new Date(),
    description: 'Accident damage',
    claimAmount: 25000,
    approvedAmount: null,
    surveyorName: null,
    surveyorDetails: null,
    createdById: 'user-123',
    updatedById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClaimsController],
      providers: [
        {
          provide: ReportClaimService,
          useValue: { execute: jest.fn().mockResolvedValue(mockClaimResponse) },
        },
        {
          provide: UploadClaimDocumentService,
          useValue: { execute: jest.fn().mockResolvedValue(mockClaimResponse) },
        },
        {
          provide: AssignSurveyorService,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              ...mockClaimResponse,
              status: ClaimStatus.SURVEYOR_ASSIGNED,
              surveyorName: 'John Doe',
              surveyorDetails: 'License S-123',
            }),
          },
        },
        {
          provide: ApproveClaimService,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              ...mockClaimResponse,
              status: ClaimStatus.APPROVED,
            }),
          },
        },
        {
          provide: SettleClaimService,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              ...mockClaimResponse,
              status: ClaimStatus.SETTLED,
            }),
          },
        },
        {
          provide: RejectClaimService,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              ...mockClaimResponse,
              status: ClaimStatus.REJECTED,
            }),
          },
        },
        {
          provide: CloseClaimService,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              ...mockClaimResponse,
              status: ClaimStatus.CLOSED,
            }),
          },
        },
        {
          provide: GetClaimsService,
          useValue: {
            executeOne: jest.fn().mockResolvedValue(mockClaimResponse),
            executeAll: jest.fn().mockResolvedValue([mockClaimResponse]),
          },
        },
      ],
    }).compile();

    controller = module.get<ClaimsController>(ClaimsController);
    reportClaimService = module.get<ReportClaimService>(ReportClaimService);
    uploadClaimDocumentService = module.get<UploadClaimDocumentService>(
      UploadClaimDocumentService,
    );
    assignSurveyorService = module.get<AssignSurveyorService>(
      AssignSurveyorService,
    );
    approveClaimService = module.get<ApproveClaimService>(ApproveClaimService);
    settleClaimService = module.get<SettleClaimService>(SettleClaimService);
    rejectClaimService = module.get<RejectClaimService>(RejectClaimService);
    closeClaimService = module.get<CloseClaimService>(CloseClaimService);
    getClaimsService = module.get<GetClaimsService>(GetClaimsService);
  });

  describe('Happy Path', () => {
    it('should report a claim', async () => {
      const dto = new ReportClaimDto();
      dto.policyId = 'policy-123';
      dto.incidentDate = new Date().toISOString();
      dto.description = 'Highway collision bumper damage.';
      dto.claimAmount = 25000;

      const result = await controller.report(dto, mockUser);
      expect(result).toEqual(mockClaimResponse);
      expect(reportClaimService.execute).toHaveBeenCalledWith(dto, mockUser.id);
    });

    it('should find all claims', async () => {
      const pagination = new PaginationDto();
      const result = await controller.findAll(pagination, mockUser);
      expect(result).toEqual([mockClaimResponse]);
      expect(getClaimsService.executeAll).toHaveBeenCalledWith(
        pagination,
        mockUser,
      );
    });

    it('should find one claim', async () => {
      const result = await controller.findOne('claim-123', mockUser);
      expect(result).toEqual(mockClaimResponse);
      expect(getClaimsService.executeOne).toHaveBeenCalledWith(
        'claim-123',
        mockUser,
      );
    });

    it('should assign a surveyor', async () => {
      const dto = new AssignSurveyorDto();
      dto.surveyorName = 'John Doe';
      dto.surveyorDetails = 'License S-123';

      const result = await controller.assignSurveyor(
        'claim-123',
        dto,
        mockUser,
      );
      expect(result.status).toEqual(ClaimStatus.SURVEYOR_ASSIGNED);
      expect(assignSurveyorService.execute).toHaveBeenCalledWith(
        'claim-123',
        dto,
        mockUser.id,
      );
    });

    it('should approve a claim', async () => {
      const dto = { approvedAmount: 22000, approvalNotes: 'Verified' };
      const result = await controller.approve(
        'claim-123',
        dto as any,
        mockUser,
      );
      expect(result.status).toEqual(ClaimStatus.APPROVED);
      expect(approveClaimService.execute).toHaveBeenCalledWith(
        'claim-123',
        dto,
        mockUser.id,
      );
    });

    it('should settle a claim', async () => {
      const dto = {
        settlementAmount: 22000,
        settlementReference: 'TXN-123',
        settlementNotes: 'Settled',
      };
      const result = await controller.settle('claim-123', dto as any, mockUser);
      expect(result.status).toEqual(ClaimStatus.SETTLED);
      expect(settleClaimService.execute).toHaveBeenCalledWith(
        'claim-123',
        dto,
        mockUser.id,
      );
    });

    it('should close a claim', async () => {
      const result = await controller.close(
        'claim-123',
        'Closed after settlement',
        mockUser,
      );
      expect(result.status).toEqual(ClaimStatus.CLOSED);
      expect(closeClaimService.execute).toHaveBeenCalledWith(
        'claim-123',
        'Closed after settlement',
        mockUser.id,
      );
    });
  });

  describe('Exception Handling', () => {
    it('should propagate NotFoundException when claim is missing', async () => {
      jest
        .spyOn(getClaimsService, 'executeOne')
        .mockRejectedValueOnce(new NotFoundException('Claim not found'));
      await expect(
        controller.findOne('claim-nonexistent', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException on invalid state transition', async () => {
      jest
        .spyOn(assignSurveyorService, 'execute')
        .mockRejectedValueOnce(new BadRequestException('Invalid transition'));
      const dto = new AssignSurveyorDto();
      await expect(
        controller.assignSurveyor('claim-123', dto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
