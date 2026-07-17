import { Test, TestingModule } from '@nestjs/testing';
import { ReportBuilderService } from '../services/report-builder.service';
import { WarehouseService } from '../../warehouse/services/warehouse.service';
import { ReportLibraryService } from '../services/report-library.service';

describe('ReportBuilderService', () => {
  let service: ReportBuilderService;

  const mockContacts = [
    { id: '1', firstName: 'Rahul', lastName: 'Sharma', fullName: 'Rahul Sharma', email: 'r@jest.com', phone: null, type: 'INDIVIDUAL', status: 'ACTIVE', city: 'Mumbai', state: 'Maharashtra', createdAt: new Date() },
    { id: '2', firstName: 'Priya', lastName: 'Singh', fullName: 'Priya Singh', email: 'p@jest.com', phone: null, type: 'CORPORATE', status: 'ACTIVE', city: 'Delhi', state: 'Delhi', createdAt: new Date() },
  ];

  const mockWarehouse = {
    getReportingContacts: jest.fn().mockResolvedValue(mockContacts),
    getReportingLeads: jest.fn().mockResolvedValue([]),
    getReportingPolicies: jest.fn().mockResolvedValue([]),
    getReportingClaims: jest.fn().mockResolvedValue([]),
    getReportingRenewals: jest.fn().mockResolvedValue([]),
    getReportingRevenue: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportBuilderService,
        ReportLibraryService,
        { provide: WarehouseService, useValue: mockWarehouse },
      ],
    }).compile();

    service = module.get<ReportBuilderService>(ReportBuilderService);
  });

  describe('runBuiltInReport', () => {
    it('should run contact-register template and return projected rows', async () => {
      const result = await service.runBuiltInReport('contact-register', {});
      expect(result.templateId).toBe('contact-register');
      expect(result.rowCount).toBe(2);
      expect(result.rows[0]).toHaveProperty('fullName');
      expect(result.rows[0]).not.toHaveProperty('id'); // id not in default columns
    });

    it('should throw NotFoundException for unknown template', async () => {
      await expect(service.runBuiltInReport('fake-report', {})).rejects.toThrow('Report template');
    });

    it('should include generatedAt and filters in result', async () => {
      const result = await service.runBuiltInReport('contact-register', { type: 'INDIVIDUAL' });
      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(result.filters.type).toBe('INDIVIDUAL');
    });
  });

  describe('runSavedReport', () => {
    it('should apply column projection on saved report', async () => {
      const result = await service.runSavedReport(
        { dataSource: 'contacts', columns: ['fullName', 'email'], filters: [], sortBy: undefined, sortDir: 'asc' },
        {},
      );
      expect(result.rowCount).toBe(2);
      expect(result.rows[0]).toHaveProperty('fullName');
      expect(result.rows[0]).toHaveProperty('email');
      expect(result.rows[0]).not.toHaveProperty('phone');
    });
  });
});
