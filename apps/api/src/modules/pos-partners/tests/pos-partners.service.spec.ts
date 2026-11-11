import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PosPartnerStatus, PosPartnerType, PosVerificationStatus } from '@prisma/client';
import { PosPartnerService } from '../services/pos-partner.service';
import { PosInsurerMappingService } from '../services/pos-insurer-mapping.service';
import { PosEligibilityService } from '../services/pos-eligibility.service';
import { PolicyAddressResolverService } from '../../policies/services/policy-address-resolver.service';

describe('POS Partner & Mandatory Policy Address Specifications', () => {
  const companyId = 'company-test-123';
  const userId = 'user-admin-123';
  const mockUser: any = { id: userId, companyId, role: 'ADMIN' };

  let mockPrisma: any;
  let mockRepo: any;
  let posPartnerService: PosPartnerService;
  let posInsurerMappingService: PosInsurerMappingService;
  let posEligibilityService: PosEligibilityService;
  let addressResolver: PolicyAddressResolverService;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      generatePosCode: jest.fn().mockImplementation((type) =>
        Promise.resolve(type === 'INDIVIDUAL' ? 'POS-IND-999999' : 'POS-CORP-999999')
      ),
      countKpis: jest.fn(),
      findEligible: jest.fn(),
    };

    mockPrisma = {
      posPartner: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      posInsurerMapping: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      posCommissionAgreement: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      posPartnerDocument: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      insurer: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      quotation: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    posPartnerService = new PosPartnerService(mockPrisma, mockRepo);
    posInsurerMappingService = new PosInsurerMappingService(mockPrisma);
    posEligibilityService = new PosEligibilityService(mockPrisma, mockRepo);
    addressResolver = new PolicyAddressResolverService(mockPrisma);
  });

  describe('DEC-01 & DEC-04: POS Partner Types and Auto-Activation', () => {
    it('should register and auto-activate an INDIVIDUAL partner with ACTIVE status', async () => {
      mockPrisma.insurer.findFirst.mockResolvedValue({
        id: 'ins-hdfc',
        name: 'HDFC ERGO General Insurance',
        code: 'HDFC_ERGO',
        isActive: true,
      });

      mockPrisma.posPartner.create.mockResolvedValue({
        id: 'pos-1',
        companyId,
        posCode: 'POS-IND-999999',
        name: 'Rajesh Sharma',
        partnerType: PosPartnerType.INDIVIDUAL,
        status: PosPartnerStatus.ACTIVE,
        verificationStatus: PosVerificationStatus.PENDING,
      });

      const result = await posPartnerService.register(
        {
          partnerType: PosPartnerType.INDIVIDUAL,
          name: 'Rajesh Sharma',
          mobile: '9876543210',
          email: 'rajesh@example.com',
          panNumber: 'ABCDE1234F',
          address: {
            addressLine1: 'Flat 101, Galaxy Apts',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
          },
          insurerId: 'ins-hdfc',
        },
        mockUser
      );

      expect(mockPrisma.posPartner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            partnerType: PosPartnerType.INDIVIDUAL,
            status: PosPartnerStatus.ACTIVE, // DEC-04: Auto-activation
          }),
        })
      );
      expect(result.status).toBe(PosPartnerStatus.ACTIVE);
    });

    it('should register and auto-activate a CORPORATE partner with ACTIVE status', async () => {
      mockPrisma.insurer.findFirst.mockResolvedValue({
        id: 'ins-icici',
        name: 'ICICI Lombard',
        code: 'ICICI_LOMBARD',
        isActive: true,
      });

      mockPrisma.posPartner.create.mockResolvedValue({
        id: 'pos-corp-1',
        companyId,
        posCode: 'POS-CORP-999999',
        name: 'Apex Motors Ltd',
        partnerType: PosPartnerType.CORPORATE,
        status: PosPartnerStatus.ACTIVE,
        verificationStatus: PosVerificationStatus.PENDING,
      });

      const result = await posPartnerService.register(
        {
          partnerType: PosPartnerType.CORPORATE,
          name: 'Apex Motors Ltd',
          mobile: '9876543211',
          email: 'contact@apexmotors.com',
          gstNumber: '27ABCDE1234F1Z5',
          address: {
            addressLine1: 'Corporate Park, Sector 5',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
          },
          insurerId: 'ins-icici',
        },
        mockUser
      );

      expect(mockPrisma.posPartner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            partnerType: PosPartnerType.CORPORATE,
            status: PosPartnerStatus.ACTIVE,
          }),
        })
      );
      expect(result.partnerType).toBe(PosPartnerType.CORPORATE);
    });

    it('should register partner and persist initial commercial agreement transactionally', async () => {
      mockPrisma.insurer.findFirst.mockResolvedValue({
        id: 'ins-hdfc',
        name: 'HDFC ERGO General Insurance',
        code: 'HDFC_ERGO',
        isActive: true,
      });

      mockPrisma.posPartner.create.mockResolvedValue({
        id: 'pos-1',
        companyId,
        posCode: 'POS-IND-999999',
        name: 'Rajesh Sharma',
        partnerType: PosPartnerType.INDIVIDUAL,
        status: PosPartnerStatus.ACTIVE,
        verificationStatus: PosVerificationStatus.PENDING,
      });

      mockPrisma.posCommissionAgreement.create.mockResolvedValue({
        id: 'agr-1',
        posPartnerId: 'pos-1',
        insurerId: 'ins-hdfc',
        productType: 'MOTOR',
        commissionType: 'PERCENTAGE',
        commissionRate: 15,
        approvalStatus: 'APPROVED',
      });

      const result = await posPartnerService.register(
        {
          partnerType: PosPartnerType.INDIVIDUAL,
          name: 'Rajesh Sharma',
          mobile: '9876543210',
          email: 'rajesh@example.com',
          panNumber: 'ABCDE1234F',
          address: {
            addressLine1: 'Flat 101, Galaxy Apts',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
          },
          insurerId: 'ins-hdfc',
          initialAgreement: {
            productType: 'MOTOR',
            commissionType: 'PERCENTAGE',
            commissionRate: 15,
          },
        },
        mockUser
      );

      expect(mockPrisma.posPartner.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.posCommissionAgreement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId,
            posPartnerId: 'pos-1',
            insurerId: 'ins-hdfc',
            productType: 'MOTOR',
            commissionType: 'PERCENTAGE',
            approvalStatus: 'APPROVED',
          }),
        })
      );
      expect(result.status).toBe(PosPartnerStatus.ACTIVE);
      expect((result as any).commissionAgreements).toHaveLength(1);
    });

    it('should reject registration if insurer ID does not exist', async () => {
      mockPrisma.insurer.findFirst.mockResolvedValue(null);

      await expect(
        posPartnerService.register(
          {
            partnerType: PosPartnerType.INDIVIDUAL,
            name: 'Rajesh Sharma',
            mobile: '9876543210',
            insurerId: 'ins-nonexistent',
          },
          mockUser
        )
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.posPartner.create).not.toHaveBeenCalled();
    });

    it('should reject registration if initial agreement insurer mismatches mapped insurer', async () => {
      mockPrisma.insurer.findFirst.mockResolvedValue({
        id: 'ins-hdfc',
        name: 'HDFC ERGO General Insurance',
        isActive: true,
      });

      await expect(
        posPartnerService.register(
          {
            partnerType: PosPartnerType.INDIVIDUAL,
            name: 'Rajesh Sharma',
            mobile: '9876543210',
            insurerId: 'ins-hdfc',
            initialAgreement: {
              insurerId: 'ins-icici',
              productType: 'MOTOR',
              commissionType: 'PERCENTAGE',
              commissionRate: 10,
            },
          },
          mockUser
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should abort and roll back transaction if agreement creation fails', async () => {
      mockPrisma.insurer.findFirst.mockResolvedValue({
        id: 'ins-hdfc',
        name: 'HDFC ERGO General Insurance',
        isActive: true,
      });

      mockPrisma.posPartner.create.mockResolvedValue({
        id: 'pos-fail',
        companyId,
        posCode: 'POS-IND-999999',
        name: 'Failed Partner',
        partnerType: PosPartnerType.INDIVIDUAL,
      });

      mockPrisma.posCommissionAgreement.create.mockRejectedValue(
        new Error('Database agreement creation failure')
      );

      await expect(
        posPartnerService.register(
          {
            partnerType: PosPartnerType.INDIVIDUAL,
            name: 'Failed Partner',
            mobile: '9876543210',
            insurerId: 'ins-hdfc',
            initialAgreement: {
              productType: 'MOTOR',
              commissionType: 'PERCENTAGE',
              commissionRate: 15,
            },
          },
          mockUser
        )
      ).rejects.toThrow('Database agreement creation failure');
    });
  });

  describe('DEC-03: Multi-insurer Agent POS mappings', () => {
    it('should reject mapping to an inactive insurer', async () => {
      mockPrisma.insurer.findUnique.mockResolvedValue({
        id: 'ins-inactive',
        name: 'Inactive Insurer Ltd',
        isActive: false,
      });
      mockPrisma.posPartner.findFirst.mockResolvedValue({
        id: 'pos-1',
        companyId,
        posCode: 'POS-IND-100',
      });

      await expect(
        posInsurerMappingService.createMapping(
          'pos-1',
          { insurerId: 'ins-inactive' },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow the same Agent POS to be mapped to a second insurer', async () => {
      mockPrisma.posPartner.findFirst.mockResolvedValue({
        id: 'pos-1',
        companyId,
        posCode: 'POS-IND-100',
      });
      mockPrisma.posInsurerMapping.findFirst.mockResolvedValue(null);
      mockPrisma.insurer.findUnique.mockResolvedValue({
        id: 'ins-tata',
        name: 'Tata AIG',
        isActive: true,
      });
      mockPrisma.posInsurerMapping.create.mockResolvedValue({
        id: 'map-tata',
        posPartnerId: 'pos-1',
        insurerId: 'ins-tata',
        insurerPartnerCode: 'TATA-AGENT-44',
        insurerPospId: 'TATA-POSP-9988',
        isActive: true,
      });

      const mapping = await posInsurerMappingService.createMapping(
        'pos-1',
        {
          insurerId: 'ins-tata',
          insurerPartnerCode: 'TATA-AGENT-44',
          insurerPospId: 'TATA-POSP-9988',
        },
        mockUser,
      );

      expect(mapping.insurerId).toBe('ins-tata');
      expect(mapping.insurerPospId).toBe('TATA-POSP-9988');
      expect(mockPrisma.posInsurerMapping.create).toHaveBeenCalled();
    });

    it('should reject duplicate mappings for the same insurer', async () => {
      mockPrisma.posPartner.findFirst.mockResolvedValue({
        id: 'pos-1',
        companyId,
        posCode: 'POS-IND-100',
      });
      mockPrisma.posInsurerMapping.findFirst.mockResolvedValue({
        id: 'map-existing',
        posPartnerId: 'pos-1',
        insurerId: 'ins-hdfc',
        isActive: true,
      });

      await expect(
        posInsurerMappingService.createMapping(
          'pos-1',
          { insurerId: 'ins-hdfc' },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should keep the backward-compatible remap endpoint additive and audit the new mapping', async () => {
      mockPrisma.posPartner.findFirst.mockResolvedValue({
        id: 'pos-1',
        companyId,
        posCode: 'POS-IND-100',
      });
      mockPrisma.posInsurerMapping.findFirst.mockResolvedValue(null);
      mockPrisma.insurer.findUnique.mockResolvedValue({
        id: 'ins-new',
        name: 'New Partner Insurer',
        isActive: true,
      });
      mockPrisma.posInsurerMapping.create.mockResolvedValue({
        id: 'map-new',
        posPartnerId: 'pos-1',
        insurerId: 'ins-new',
        isActive: true,
      });

      const added = await posInsurerMappingService.remapInsurer(
        'pos-1',
        { insurerId: 'ins-new', reason: 'Additional insurer partnership' },
        mockUser,
      );

      expect(added.insurerId).toBe('ins-new');
      expect(mockPrisma.posInsurerMapping.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });


    it('should register an Agent POS without an insurer mapping', async () => {
      mockPrisma.posPartner.create.mockResolvedValue({
        id: 'pos-unmapped',
        companyId,
        posCode: 'POS-IND-UNMAPPED',
        name: 'Unmapped Agent POS',
        partnerType: PosPartnerType.INDIVIDUAL,
        status: PosPartnerStatus.ACTIVE,
        verificationStatus: PosVerificationStatus.PENDING,
      });

      const result = await posPartnerService.register({
        partnerType: PosPartnerType.INDIVIDUAL,
        name: 'Unmapped Agent POS',
        mobile: '9876543210',
        email: 'agent@example.com',
      }, mockUser);

      expect(result.id).toBe('pos-unmapped');
      expect(mockPrisma.posPartner.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.not.objectContaining({ insurerMappings: expect.anything() }),
      }));
    });

  describe('DEC-02: Optional Agent POS Attribution & Eligibility', () => {
    it('should throw NotFoundException if requested POS partner is not found in tenant', async () => {
      mockPrisma.posPartner.findUnique.mockResolvedValue(null);

      await expect(
        posEligibilityService.assertEligibleForIssuance({
          posPartnerId: 'unknown-pos',
          companyId,
          policyInsurerName: 'HDFC ERGO',
          productType: 'MOTOR',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if partner is SUSPENDED', async () => {
      mockPrisma.posPartner.findUnique.mockResolvedValue({
        id: 'pos-suspended',
        companyId,
        name: 'Suspended Agent',
        status: PosPartnerStatus.SUSPENDED,
        insurerMappings: [{
          id: 'map-1',
          isActive: true,
          insurer: { name: 'HDFC ERGO', code: 'HDFC_ERGO' },
        }],
      });

      await expect(
        posEligibilityService.assertEligibleForIssuance({
          posPartnerId: 'pos-suspended',
          companyId,
          policyInsurerName: 'HDFC ERGO',
          productType: 'MOTOR',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow POS attribution when no mapping exists for the policy insurer', async () => {
      mockPrisma.posPartner.findUnique.mockResolvedValue({
        id: 'pos-icici',
        companyId,
        name: 'ICICI Dedicated Partner',
        posCode: 'POS-IND-ICICI',
        status: PosPartnerStatus.ACTIVE,
        effectiveFrom: new Date('2020-01-01'),
        effectiveUntil: null,
        insurerMappings: [{
          id: 'map-1',
          isActive: true,
          effectiveFrom: new Date('2020-01-01'),
          effectiveUntil: null,
          insurer: {
            id: 'ins-icici',
            name: 'ICICI Lombard',
            code: 'ICICI_LOMBARD',
            isActive: true,
          },
        }],
      });

      const result = await posEligibilityService.assertEligibleForIssuance({
        posPartnerId: 'pos-icici',
        companyId,
        policyInsurerName: 'HDFC ERGO',
        productType: 'MOTOR',
      });

      expect(result.partner.id).toBe('pos-icici');
      expect(result.mapping).toBeNull();
      expect(result.insurer).toBeNull();
    });

    it('should allow an active POS partner with no insurer mappings', async () => {
      mockPrisma.posPartner.findUnique.mockResolvedValue({
        id: 'pos-unmapped',
        companyId,
        name: 'Unmapped POS',
        posCode: 'POS-UNMAPPED',
        status: PosPartnerStatus.ACTIVE,
        effectiveFrom: new Date('2020-01-01'),
        effectiveUntil: null,
        insurerMappings: [],
      });

      const result = await posEligibilityService.assertEligibleForIssuance({
        posPartnerId: 'pos-unmapped',
        companyId,
        policyInsurerName: 'HDFC ERGO',
        productType: 'MOTOR',
      });

      expect(result.partner.id).toBe('pos-unmapped');
      expect(result.mapping).toBeNull();
    });

    it('should succeed and return snapshots when partner is ACTIVE and insurer matches', async () => {
      const partner = {
        id: 'pos-hdfc',
        companyId,
        name: 'HDFC Approved POS',
        posCode: 'POS-IND-100200',
        status: PosPartnerStatus.ACTIVE,
        effectiveFrom: new Date('2020-01-01'),
        effectiveUntil: null,
        insurerMappings: [
          {
            id: 'map-icici',
            insurerId: 'ins-icici',
            isActive: true,
            effectiveFrom: new Date('2020-01-01'),
            effectiveUntil: null,
            insurer: { id: 'ins-icici', name: 'ICICI Lombard', code: 'ICICI_LOMBARD', isActive: true },
          },
          {
            id: 'map-hdfc',
            insurerId: 'ins-hdfc',
            isActive: true,
            effectiveFrom: new Date('2020-01-01'),
            effectiveUntil: null,
            insurer: {
              id: 'ins-hdfc',
              name: 'HDFC ERGO General Insurance',
              code: 'HDFC_ERGO',
              isActive: true,
            },
          },
        ],
      };

      mockPrisma.posPartner.findUnique.mockResolvedValue(partner);

      const result = await posEligibilityService.assertEligibleForIssuance({
        posPartnerId: 'pos-hdfc',
        companyId,
        policyInsurerName: 'HDFC ERGO General Insurance',
        productType: 'MOTOR',
      });

      expect(result.partner.id).toBe('pos-hdfc');
      expect(result.insurer.code).toBe('HDFC_ERGO');
    });
  });

  describe('DEC-06: Mandatory Structured Address Resolution', () => {
    it('should validate complete explicit address input at policy stage', async () => {
      mockPrisma.quotation.findUnique.mockResolvedValue({
        id: 'quote-1',
        companyId,
        motorMetadata: {},
        contact: null,
      });

      const result = await addressResolver.resolveAddress('quote-1', {
        addressLine1: '123 Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400020',
      });

      expect(result.isValid).toBe(true);
      expect(result.addressSource).toBe('EXPLICIT_POLICY_INPUT');
      expect(result.address.pincode).toBe('400020');
      expect(result.missingFields).toHaveLength(0);
    });

    it('should report missing fields when address is incomplete', async () => {
      mockPrisma.quotation.findUnique.mockResolvedValue({
        id: 'quote-1',
        companyId,
        motorMetadata: {},
        contact: null,
      });

      const result = await addressResolver.resolveAddress('quote-1', {
        addressLine1: 'Some street',
        // missing city, state, pincode
      });

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('city');
      expect(result.missingFields).toContain('state');
      expect(result.missingFields.some((f: string) => f.includes('pincode'))).toBe(true);
    });

    it('should fall back to linked contact or customer profile when quotation address is incomplete', async () => {
      mockPrisma.quotation.findUnique.mockResolvedValue({
        id: 'quote-1',
        companyId,
        motorMetadata: {},
        contact: {
          address: '45 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
          customer: null,
        },
      });

      const result = await addressResolver.resolveAddress('quote-1', undefined);

      expect(result.isValid).toBe(true);
      expect(result.addressSource).toBe('CONTACT_PROFILE');
      expect(result.address.city).toBe('Bengaluru');
      expect(result.address.state).toBe('Karnataka');
      expect(result.address.pincode).toBe('560001');
    });
  });
});
