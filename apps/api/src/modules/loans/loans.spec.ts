import { LoanCalculationService } from './services/loan-calculation.service';
import { LoanCaseService } from './services/loan-case.service';
import { LoanCategory, LoanEnquiryStatus } from '@prisma/client';

describe('Loans Module Unit Tests', () => {
  describe('LoanCalculationService', () => {
    let service: LoanCalculationService;

    beforeEach(() => {
      service = new LoanCalculationService();
    });

    describe('calculateEmi', () => {
      it('should accurately calculate standard reducing-balance EMI for Home Loan', () => {
        const emi = service.calculateEmi(5000000, 8.5, 240);
        expect(emi).toBe(43391);
      });

      it('should return 0 for zero or invalid inputs', () => {
        expect(service.calculateEmi(0, 8.5, 240)).toBe(0);
        expect(service.calculateEmi(5000000, 8.5, 0)).toBe(0);
      });
    });

    describe('calculateTotalCharges', () => {
      it('should calculate base fee, 18% GST and total fee correctly', () => {
        const result = service.calculateTotalCharges(25000, 0, 0.18);
        expect(result.baseFee).toBe(25000);
        expect(result.gstAmount).toBe(4500);
        expect(result.totalChargesInclGst).toBe(29500);
      });
    });

    describe('calculateLtv', () => {
      it('should calculate LTV ratio as percentage', () => {
        const ltv = service.calculateLtv(7500000, 10000000);
        expect(ltv).toBe(75);
      });

      it('should return 0 when collateral is zero or not provided', () => {
        expect(service.calculateLtv(7500000, 0)).toBe(0);
      });
    });

    describe('calculateFoir', () => {
      it('should calculate FOIR percentage including existing and proposed EMIs', () => {
        const foir = service.calculateFoir(15000, 43391, 100000);
        expect(foir).toBe(58.39);
      });

      it('should return 0 when net income is zero or not provided', () => {
        expect(service.calculateFoir(15000, 43391, 0)).toBe(0);
      });
    });

    describe('calculateCommission', () => {
      it('should calculate gross commission, customer discount and net payout', () => {
        const result = service.calculateCommission(5000000, 1.0, 12500);
        expect(result.grossCommissionAmount).toBe(50000);
        expect(result.customerDiscountAmount).toBe(12500);
        expect(result.netCommissionPayable).toBe(37500);
      });
    });
  });

  describe('LoanCaseService Workflow & Issuance', () => {
    let service: LoanCaseService;
    let mockPrisma: any;
    let mockNumbering: any;
    let mockAuthz: any;
    let mockScope: any;
    let mockCalc: any;

    const mockActor: any = {
      userId: 'usr-123',
      organizationId: 'comp-123',
      roles: ['ADMIN'],
    };

    beforeEach(() => {
      mockPrisma = {
        contact: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        loanApplicationCase: {
          create: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
        },
        loanFacility: {
          create: jest.fn(),
        },
        loanParty: {
          create: jest.fn(),
        },
        loanLenderOffer: {
          update: jest.fn(),
        },
        backOfficeTask: {
          updateMany: jest.fn(),
        },
        $transaction: jest.fn((cb) => cb(mockPrisma)),
      };

      mockNumbering = {
        generateNext: jest.fn().mockResolvedValue('LN-2026-0001'),
      };

      mockAuthz = {
        authorize: jest.fn(),
      };

      mockScope = {
        resolveScopeFilter: jest.fn().mockReturnValue({ companyId: 'comp-123' }),
      };

      mockCalc = new LoanCalculationService();

      service = new LoanCaseService(
        mockPrisma,
        mockNumbering,
        mockAuthz,
        mockScope,
        mockCalc,
      );
    });

    it('should create loan case with applicant fallback when contactId is omitted', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);
      mockPrisma.contact.create.mockResolvedValue({
        id: 'cnt-new-1',
        firstName: 'Rahul',
        lastName: 'Sharma',
        phone: '9876543210',
        email: 'rahul@example.com',
      });

      mockPrisma.loanApplicationCase.create.mockResolvedValue({
        id: 'case-1',
        caseCode: 'LN-2026-0001',
        status: LoanEnquiryStatus.DRAFT,
        category: LoanCategory.HOME_LOAN,
        contactId: 'cnt-new-1',
      });

      const res = await service.createCase(
        {
          category: LoanCategory.HOME_LOAN,
          applicant: {
            firstName: 'Rahul',
            lastName: 'Sharma',
            phone: '9876543210',
            email: 'rahul@example.com',
          },
          monthlyIncome: 80000,
        },
        mockActor,
      );

      expect(mockPrisma.contact.create).toHaveBeenCalled();
      expect(mockPrisma.loanApplicationCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contactId: 'cnt-new-1',
            monthlyIncome: 80000,
            annualIncome: 960000,
            status: LoanEnquiryStatus.DRAFT,
          }),
        }),
      );
      expect(res.id).toBe('case-1');
    });

    it('should issue sanction on a loan case and transition status to SANCTIONED', async () => {
      const existingCase = {
        id: 'case-1',
        caseCode: 'LN-2026-0001',
        status: LoanEnquiryStatus.OFFER_SELECTED,
        facilities: [
          {
            id: 'fac-1',
            selectedOfferId: 'off-1',
          },
        ],
        categoryData: {},
      };

      mockPrisma.loanApplicationCase.findUnique.mockResolvedValue(existingCase);
      mockPrisma.loanApplicationCase.update.mockResolvedValue({
        ...existingCase,
        status: LoanEnquiryStatus.SANCTIONED,
      });

      const res = await service.issueSanction(
        'case-1',
        {
          sanctionDate: '2026-11-06',
          sanctionedAmount: 5000000,
          notes: 'Sanction letter verified',
        },
        mockActor,
      );

      expect(mockPrisma.loanLenderOffer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'off-1' },
        }),
      );
      expect(mockPrisma.loanApplicationCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: expect.objectContaining({
            status: LoanEnquiryStatus.SANCTIONED,
          }),
        }),
      );
      expect(res.status).toBe(LoanEnquiryStatus.SANCTIONED);
    });

    it('should formally issue and disburse loan, transition to DISBURSED and store disbursement details', async () => {
      const existingCase = {
        id: 'case-1',
        caseCode: 'LN-2026-0001',
        status: LoanEnquiryStatus.SANCTIONED,
        facilities: [
          {
            id: 'fac-1',
            requestedAmount: 5000000,
            selectedOffer: {
              id: 'off-1',
              lenderName: 'HDFC Bank',
              offeredAmount: 5000000,
            },
          },
        ],
        categoryData: {},
      };

      mockPrisma.loanApplicationCase.findUnique.mockResolvedValue(existingCase);
      mockPrisma.loanApplicationCase.update.mockResolvedValue({
        ...existingCase,
        status: LoanEnquiryStatus.DISBURSED,
      });

      const res = await service.issueLoanDisbursement(
        'case-1',
        {
          loanAccountNumber: 'HDFC-HL-2026-0099',
          disbursementDate: '2026-11-06',
          disbursedAmount: 5000000,
          utrNumber: 'HDFCN26110600123',
          bankName: 'HDFC Bank',
        },
        mockActor,
      );

      expect(mockPrisma.loanApplicationCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: expect.objectContaining({
            status: LoanEnquiryStatus.DISBURSED,
            categoryData: expect.objectContaining({
              disbursementDetails: expect.objectContaining({
                loanAccountNumber: 'HDFC-HL-2026-0099',
                utrNumber: 'HDFCN26110600123',
                bankName: 'HDFC Bank',
              }),
            }),
          }),
        }),
      );
      expect(res.status).toBe(LoanEnquiryStatus.DISBURSED);
    });
  });
});
