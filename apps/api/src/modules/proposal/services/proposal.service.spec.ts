import { Test, TestingModule } from '@nestjs/testing';
import { ProposalService } from './proposal.service';
import { PrismaService } from '../../../database/prisma.service';
import { WorkflowEngineService } from '../../platform/workflow/services/workflow-engine.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProposalStatus, InspectionStatus } from '@prisma/client';

describe('ProposalService & Inspection Gateway (Iteration 6)', () => {
  let service: ProposalService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      quotation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      motorInspection: {
        findUnique: jest.fn(),
      },
      proposal: {
        create: jest.fn(),
      },
      proposalDocument: {
        create: jest.fn(),
      },
      proposalHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProposalService,
        { provide: PrismaService, useValue: prisma },
        { provide: WorkflowEngineService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProposalService>(ProposalService);
  });

  describe('createProposal with Inspection Gateway', () => {
    const validQuotation = {
      id: 'q-1',
      contactId: 'c-1',
      expiryDate: new Date(Date.now() + 86400000), // tomorrow
      totalPremium: 15000,
    };

    it('should create proposal when no inspection is required', async () => {
      prisma.quotation.findUnique.mockResolvedValue(validQuotation);
      prisma.motorInspection.findUnique.mockResolvedValue(null);
      prisma.proposal.create.mockResolvedValue({
        id: 'prop-1',
        proposalNumber: 'PROP-1234',
        status: ProposalStatus.DRAFT,
      });

      const result = await service.createProposal('q-1', 'usr-agent-1');

      expect(result).toBeDefined();
      expect(prisma.proposal.create).toHaveBeenCalled();
    });

    it('should create proposal when inspection status is COMPLETED', async () => {
      prisma.quotation.findUnique.mockResolvedValue(validQuotation);
      prisma.motorInspection.findUnique.mockResolvedValue({
        id: 'ins-1',
        status: InspectionStatus.COMPLETED,
      });
      prisma.proposal.create.mockResolvedValue({
        id: 'prop-1',
        proposalNumber: 'PROP-1234',
        status: ProposalStatus.DRAFT,
      });

      const result = await service.createProposal('q-1', 'usr-agent-1');

      expect(result).toBeDefined();
    });

    it('should block proposal creation when inspection is still PENDING', async () => {
      prisma.quotation.findUnique.mockResolvedValue(validQuotation);
      prisma.motorInspection.findUnique.mockResolvedValue({
        id: 'ins-1',
        status: InspectionStatus.PENDING,
      });

      await expect(
        service.createProposal('q-1', 'usr-agent-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block proposal creation when inspection was REJECTED', async () => {
      prisma.quotation.findUnique.mockResolvedValue(validQuotation);
      prisma.motorInspection.findUnique.mockResolvedValue({
        id: 'ins-1',
        status: InspectionStatus.REJECTED,
      });

      await expect(
        service.createProposal('q-1', 'usr-agent-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block proposal creation when quotation has expired', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...validQuotation,
        expiryDate: new Date(Date.now() - 86400000), // yesterday
      });

      await expect(
        service.createProposal('q-1', 'usr-agent-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
