import { Test, TestingModule } from '@nestjs/testing';
import { ReportFilterOperator } from '@prisma/client';
import { ReportBuilderService } from '../services/report-builder.service';
import { WarehouseService } from '../../../warehouse/services/warehouse.service';
import { ReportDataProviderRegistry } from '../services/report-data-provider-registry.service';

describe('ReportBuilderService', () => {
  let service: ReportBuilderService;

  const mockContacts = [
    {
      id: '1',
      firstName: 'Rahul',
      lastName: 'Sharma',
      fullName: 'Rahul Sharma',
      email: 'rahul@jest.com',
      phone: null,
      type: 'INDIVIDUAL',
      status: 'ACTIVE',
      city: 'Mumbai',
      state: 'Maharashtra',
      createdAt: new Date('2026-01-01'),
    },
    {
      id: '2',
      firstName: 'Priya',
      lastName: 'Singh',
      fullName: 'Priya Singh',
      email: 'priya@jest.com',
      phone: null,
      type: 'CORPORATE',
      status: 'ACTIVE',
      city: 'Delhi',
      state: 'Delhi',
      createdAt: new Date('2026-02-01'),
    },
  ];

  const mockWarehouse = {
    getReportingContacts: jest.fn().mockResolvedValue(mockContacts),
    getReportingLeads: jest.fn().mockResolvedValue([]),
    getReportingPolicies: jest.fn().mockResolvedValue([]),
    getReportingClaims: jest.fn().mockResolvedValue([]),
    getReportingRenewals: jest.fn().mockResolvedValue([]),
    getReportingRevenue: jest.fn().mockResolvedValue([]),
  };

  const mockRegistry = {
    getProvider: jest.fn().mockReturnValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportBuilderService,
        { provide: WarehouseService, useValue: mockWarehouse },
        { provide: ReportDataProviderRegistry, useValue: mockRegistry },
      ],
    }).compile();

    service = module.get<ReportBuilderService>(ReportBuilderService);
  });

  it('should project columns correctly', async () => {
    const reportMock: any = {
      module: 'contacts',
      columns: [
        { field: 'fullName', label: 'Full Name', type: 'STRING' },
        { field: 'email', label: 'Email', type: 'STRING' },
      ],
      filters: [],
    };

    const result = await service.buildReportData(reportMock, {});
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      fullName: 'Rahul Sharma',
      email: 'rahul@jest.com',
    });
  });

  it('should filter EQUALS status correctly', async () => {
    const reportMock: any = {
      module: 'contacts',
      columns: [
        { field: 'fullName', label: 'Full Name', type: 'STRING' },
        { field: 'type', label: 'Type', type: 'STRING' },
      ],
      filters: [
        {
          field: 'type',
          operator: ReportFilterOperator.EQUALS,
          defaultValue: 'INDIVIDUAL',
          required: true,
        },
      ],
    };

    const result = await service.buildReportData(reportMock, {
      type: 'INDIVIDUAL',
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].fullName).toBe('Rahul Sharma');
  });

  it('should filter CONTAINS email correctly', async () => {
    const reportMock: any = {
      module: 'contacts',
      columns: [
        { field: 'fullName', label: 'Full Name', type: 'STRING' },
        { field: 'email', label: 'Email', type: 'STRING' },
      ],
      filters: [
        {
          field: 'email',
          operator: ReportFilterOperator.CONTAINS,
          defaultValue: null,
          required: false,
        },
      ],
    };

    const result = await service.buildReportData(reportMock, {
      email: 'priya',
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].fullName).toBe('Priya Singh');
  });

  it('should apply global search across visible columns', async () => {
    const reportMock: any = {
      module: 'contacts',
      columns: [
        {
          field: 'fullName',
          label: 'Full Name',
          type: 'STRING',
          visible: true,
        },
        { field: 'city', label: 'City', type: 'STRING', visible: true },
      ],
      filters: [],
    };

    const result = await service.buildReportData(
      reportMock,
      {},
      { search: 'mumbai' },
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].fullName).toBe('Rahul Sharma');
  });

  it('should limit result rows in preview mode', async () => {
    const reportMock: any = {
      module: 'contacts',
      columns: [{ field: 'fullName', label: 'Full Name', type: 'STRING' }],
      filters: [],
    };

    const result = await service.buildReportData(reportMock, {}, { limit: 1 });
    expect(result.rows).toHaveLength(1);
  });
});
