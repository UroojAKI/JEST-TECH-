import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  UpdateHealthCaseLeftoverDetailsDto,
  UpdateHealthAddressDto,
} from '../dto/health-quotation-case.dto';
import { HealthQuotationCaseService } from '../services/health-quotation-case.service';
import { NomineeRelation, ProposerOccupation } from '@prisma/client';

describe('Health Case Leftover Details & Address Integration (Regression Suite)', () => {
  const validateDto = async (plain: any) => {
    const instance = plainToInstance(UpdateHealthCaseLeftoverDetailsDto, plain);
    return validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  };

  describe('DTO Validation Contract', () => {
    it('Case 1: Save complete communication address -> passes validation', async () => {
      const payload = {
        address: {
          line1: 'Sector 2 near yusufia masjid shubash nagar',
          line2: 'saifulla mansion',
          city: 'Belgaum',
          state: 'Karnataka',
          pincode: '590016',
        },
      };
      const errors = await validateDto(payload);
      expect(errors.length).toBe(0);
    });

    it('Case 2: Save without optional address line 2 -> passes validation', async () => {
      const payload = {
        address: {
          line1: 'Sector 2 near yusufia masjid shubash nagar',
          city: 'Belgaum',
          state: 'Karnataka',
          pincode: '590016',
        },
      };
      const errors = await validateDto(payload);
      expect(errors.length).toBe(0);
    });

    it('Case 3: Save with empty line 1 when address is provided -> fails validation', async () => {
      const payload = {
        address: {
          line1: '',
          city: 'Belgaum',
          state: 'Karnataka',
          pincode: '590016',
        },
      };
      const errors = await validateDto(payload);
      expect(errors.length).toBeGreaterThan(0);
      const addressError = errors.find((e) => e.property === 'address');
      expect(addressError).toBeDefined();
      const childErrors = addressError?.children || [];
      expect(childErrors.some((c) => c.property === 'line1')).toBe(true);
    });

    it('Case 4: Save with numeric address line 1 -> fails validation', async () => {
      const payload = {
        address: {
          line1: 12345,
          city: 'Belgaum',
          state: 'Karnataka',
          pincode: '590016',
        },
      };
      const errors = await validateDto(payload);
      expect(errors.length).toBeGreaterThan(0);
      const addressError = errors.find((e) => e.property === 'address');
      const childErrors = addressError?.children || [];
      expect(childErrors.some((c) => c.property === 'line1')).toBe(true);
    });

    it('Case 8: Submit unknown address properties (e.g. addressLine1) -> fails validation with forbidNonWhitelisted', async () => {
      const payload = {
        address: {
          addressLine1: 'Sector 2 near yusufia masjid shubash nagar',
          addressLine2: 'saifulla mansion',
          city: 'Belgaum',
          state: 'Karnataka',
          pincode: '590016',
        },
      };
      const errors = await validateDto(payload);
      expect(errors.length).toBeGreaterThan(0);
      const addressError = errors.find((e) => e.property === 'address');
      const childErrors = addressError?.children || [];
      expect(childErrors.some((c) => c.property === 'addressLine1')).toBe(true);
    });
  });

  describe('Service Address Persistence & Partial Updates', () => {
    const user = {
      id: 'user-1',
      userId: 'user-1',
      companyId: 'company-1',
      role: 'ADMIN',
    } as any;

    const baseCase = {
      id: 'case-1',
      contactId: 'contact-1',
      companyId: 'company-1',
      nomineeName: 'Old Nominee',
      nomineeRelation: NomineeRelation.SPOUSE,
      occupation: ProposerOccupation.SALARIED,
      annualIncome: '1000000',
      addressSnapshot: {
        line1: 'Sector 2 near yusufia masjid shubash nagar',
        line2: 'saifulla mansion',
        city: 'Belgaum',
        state: 'Karnataka',
        pincode: '590016',
      },
      customerSnapshot: {
        firstName: 'John',
        lastName: 'Doe',
        hasPan: true,
        hasAadhaar: true,
      },
      contact: {
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        panNumber: 'ABCDE1234F',
        aadhaarNumber: '123412341234',
        email: 'john@example.com',
        phone: '9876543210',
      },
      quotations: [],
    };

    it('Case 5: Update nominee without changing address -> existing address preserved', async () => {
      let updatedData: any = null;
      const prisma = {
        healthQuotationCase: {
          findFirst: jest.fn().mockResolvedValue(baseCase),
          update: jest.fn().mockImplementation(({ data }) => {
            updatedData = data;
            return { ...baseCase, ...data };
          }),
        },
        contact: {
          update: jest.fn(),
        },
        customer: {
          updateMany: jest.fn(),
        },
      };

      const service = new HealthQuotationCaseService(
        prisma as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await service.updateLeftoverDetails(
        'case-1',
        {
          nomineeName: 'Jane Doe',
          nomineeRelation: NomineeRelation.SPOUSE,
        },
        user,
      );

      expect(updatedData).toBeDefined();
      expect(updatedData.nomineeName).toBe('Jane Doe');
      // Address was not passed, so addressSnapshot must not be updated or overwritten
      expect(updatedData.addressSnapshot).toBeUndefined();
      expect(prisma.customer.updateMany).not.toHaveBeenCalled();
    });

    it('Case 6: Update only city -> other address fields in addressSnapshot preserved', async () => {
      let updatedData: any = null;
      let customerData: any = null;
      const prisma = {
        healthQuotationCase: {
          findFirst: jest.fn().mockResolvedValue(baseCase),
          update: jest.fn().mockImplementation(({ data }) => {
            updatedData = data;
            return { ...baseCase, ...data };
          }),
        },
        contact: {
          update: jest.fn(),
        },
        customer: {
          updateMany: jest.fn().mockImplementation(({ data }) => {
            customerData = data;
          }),
        },
      };

      const service = new HealthQuotationCaseService(
        prisma as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await service.updateLeftoverDetails(
        'case-1',
        {
          address: {
            city: 'Hubli',
          },
        },
        user,
      );

      expect(updatedData).toBeDefined();
      expect(updatedData.addressSnapshot).toEqual({
        line1: 'Sector 2 near yusufia masjid shubash nagar',
        line2: 'saifulla mansion',
        city: 'Hubli',
        state: 'Karnataka',
        pincode: '590016',
      });
      expect(customerData).toEqual({
        city: 'Hubli',
      });
    });

    it('Case 9: Submit another valid KYC field -> address remains unchanged', async () => {
      let updatedData: any = null;
      let contactData: any = null;
      const prisma = {
        healthQuotationCase: {
          findFirst: jest.fn().mockResolvedValue(baseCase),
          update: jest.fn().mockImplementation(({ data }) => {
            updatedData = data;
            return { ...baseCase, ...data };
          }),
        },
        contact: {
          update: jest.fn().mockImplementation(({ data }) => {
            contactData = data;
            return { ...baseCase.contact, ...data };
          }),
        },
        customer: {
          updateMany: jest.fn(),
        },
      };

      const service = new HealthQuotationCaseService(
        prisma as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await service.updateLeftoverDetails(
        'case-1',
        {
          email: 'updated-john@example.com',
          phone: '9988776655',
        },
        user,
      );

      expect(contactData).toEqual({
        email: 'updated-john@example.com',
        phone: '9988776655',
      });
      expect(updatedData.addressSnapshot).toBeUndefined();
    });

    it('Case 7: Legacy addressLine1 in previous snapshot is normalized to line1 on update', async () => {
      const legacyCase = {
        ...baseCase,
        addressSnapshot: {
          addressLine1: 'Old Address 1',
          addressLine2: 'Old Address 2',
          city: 'Old City',
          state: 'Old State',
          pincode: '560001',
        },
      };

      let updatedData: any = null;
      const prisma = {
        healthQuotationCase: {
          findFirst: jest.fn().mockResolvedValue(legacyCase),
          update: jest.fn().mockImplementation(({ data }) => {
            updatedData = data;
            return { ...legacyCase, ...data };
          }),
        },
        contact: {
          update: jest.fn(),
        },
        customer: {
          updateMany: jest.fn(),
        },
      };

      const service = new HealthQuotationCaseService(
        prisma as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await service.updateLeftoverDetails(
        'case-1',
        {
          address: {
            city: 'Belgaum',
          },
        },
        user,
      );

      expect(updatedData.addressSnapshot).toEqual({
        line1: 'Old Address 1',
        line2: 'Old Address 2',
        city: 'Belgaum',
        state: 'Old State',
        pincode: '560001',
      });
    });
  });
});
