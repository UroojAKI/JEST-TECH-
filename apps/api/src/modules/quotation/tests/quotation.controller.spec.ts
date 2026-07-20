import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { QuotationStatus, RoleType } from '@prisma/client';

import { QuotationController } from '../controllers/quotation.controller';
import { GenerateQuotationService } from '../services/commands/generate-quotation.service';
import { ApproveQuotationService } from '../services/commands/approve-quotation.service';
import { RejectQuotationService } from '../services/commands/reject-quotation.service';
import { ConvertQuotationService } from '../services/commands/convert-quotation.service';
import { GetQuotationService } from '../services/queries/get-quotation.service';
import { CompareQuotationService } from '../services/queries/compare-quotation.service';
import { GetQuotationHistoryService } from '../services/queries/get-quotation-history.service';
import { CreateQuotationDto } from '../dto/create-quotation.dto';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

describe('QuotationController', () => {
  let controller: QuotationController;
  let generateService: GenerateQuotationService;
  let approveService: ApproveQuotationService;
  let rejectService: RejectQuotationService;
  let convertService: ConvertQuotationService;
  let getService: GetQuotationService;
  let compareService: CompareQuotationService;
  let historyService: GetQuotationHistoryService;

  const mockUser: RequestUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: RoleType.SALES_AGENT,
    permissions: [],
  };

  const mockQuotationResponse = {
    id: 'quote-123',
    quotationCode: 'QT-000001',
    title: 'Test Quote',
    status: QuotationStatus.DRAFT,
    leadId: null,
    contactId: 'contact-123',
    accountId: null,
    insurerName: 'Partner Insurer',
    productType: 'MOTOR',
    sumInsured: 500000,
    basePremium: 10000,
    gstAmount: 1800,
    totalPremium: 11800,
    ncbPercentage: 0,
    discountAmount: 0,
    expiryDate: new Date(),
    createdById: 'user-123',
    updatedById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuotationController],
      providers: [
        {
          provide: GenerateQuotationService,
          useValue: {
            execute: jest.fn().mockResolvedValue(mockQuotationResponse),
          },
        },
        {
          provide: ApproveQuotationService,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              ...mockQuotationResponse,
              status: QuotationStatus.APPROVED,
            }),
          },
        },
        {
          provide: RejectQuotationService,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              ...mockQuotationResponse,
              status: QuotationStatus.REJECTED,
            }),
          },
        },
        {
          provide: ConvertQuotationService,
          useValue: {
            execute: jest
              .fn()
              .mockResolvedValue({ message: 'Success', policyStub: {} }),
          },
        },
        {
          provide: GetQuotationService,
          useValue: {
            executeOne: jest.fn().mockResolvedValue(mockQuotationResponse),
            executeAll: jest.fn().mockResolvedValue([mockQuotationResponse]),
          },
        },
        {
          provide: CompareQuotationService,
          useValue: {
            execute: jest
              .fn()
              .mockResolvedValue({ comparisonCode: 'COMP-123', items: [] }),
          },
        },
        {
          provide: GetQuotationHistoryService,
          useValue: { execute: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    controller = module.get<QuotationController>(QuotationController);
    generateService = module.get<GenerateQuotationService>(
      GenerateQuotationService,
    );
    approveService = module.get<ApproveQuotationService>(
      ApproveQuotationService,
    );
    rejectService = module.get<RejectQuotationService>(RejectQuotationService);
    convertService = module.get<ConvertQuotationService>(
      ConvertQuotationService,
    );
    getService = module.get<GetQuotationService>(GetQuotationService);
    compareService = module.get<CompareQuotationService>(
      CompareQuotationService,
    );
    historyService = module.get<GetQuotationHistoryService>(
      GetQuotationHistoryService,
    );
  });

  // 1. Happy Path
  describe('Happy Path', () => {
    it('should generate a quotation', async () => {
      const dto = new CreateQuotationDto();
      dto.title = 'Test Quote';
      dto.contactId = 'contact-123';
      dto.insurerName = 'Partner Insurer';
      dto.productType = 'MOTOR';
      dto.sumInsured = 500000;
      dto.expiryDate = new Date().toISOString();

      const result = await controller.create(dto, mockUser);
      expect(result).toEqual(mockQuotationResponse);
      expect(generateService.execute).toHaveBeenCalledWith(dto, mockUser.id);
    });

    it('should find one quotation', async () => {
      const result = await controller.findOne('quote-123');
      expect(result).toEqual(mockQuotationResponse);
      expect(getService.executeOne).toHaveBeenCalledWith('quote-123');
    });

    it('should approve a quotation', async () => {
      const result = await controller.approve(
        'quote-123',
        'Approving quote',
        mockUser,
      );
      expect(result.status).toEqual(QuotationStatus.APPROVED);
      expect(approveService.execute).toHaveBeenCalledWith(
        'quote-123',
        'Approving quote',
        mockUser.id,
      );
    });
  });

  // 2. Validation Failure
  describe('Validation Failure', () => {
    it('should throw BadRequestException for missing required parameters', async () => {
      jest
        .spyOn(generateService, 'execute')
        .mockRejectedValueOnce(new BadRequestException('Validation failed'));
      const invalidDto = new CreateQuotationDto();

      await expect(controller.create(invalidDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // 3. Unauthorized
  describe('Unauthorized', () => {
    it('should throw UnauthorizedException when credentials are invalid', async () => {
      jest
        .spyOn(getService, 'executeOne')
        .mockRejectedValueOnce(
          new UnauthorizedException('Unauthorized access'),
        );

      await expect(controller.findOne('quote-123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // 4. Forbidden
  describe('Forbidden', () => {
    it('should throw ForbiddenException when user role lacks permissions', async () => {
      jest
        .spyOn(approveService, 'execute')
        .mockRejectedValueOnce(new ForbiddenException('Access denied'));

      await expect(
        controller.approve('quote-123', 'Comments', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // 5. Not Found
  describe('Not Found', () => {
    it('should throw NotFoundException when quotation does not exist', async () => {
      jest
        .spyOn(getService, 'executeOne')
        .mockRejectedValueOnce(new NotFoundException('Quotation not found'));

      await expect(controller.findOne('quote-nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // 6. Conflict
  describe('Conflict', () => {
    it('should throw ConflictException for transition conflicts', async () => {
      jest
        .spyOn(approveService, 'execute')
        .mockRejectedValueOnce(
          new ConflictException('Quotation in invalid state'),
        );

      await expect(
        controller.approve('quote-123', 'Comments', mockUser),
      ).rejects.toThrow(ConflictException);
    });
  });
});
