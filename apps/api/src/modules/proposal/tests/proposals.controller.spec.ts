import { Test, TestingModule } from '@nestjs/testing';
import { ProposalsController } from '../controllers/proposals.controller';
import { ProposalService } from '../services/proposal.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import { RoleType, ProposalStatus } from '@prisma/client';

describe('ProposalsController', () => {
  let controller: ProposalsController;
  let service: ProposalService;

  const mockUser: RequestUser = {
    id: 'user-123',
    email: 'agent@jestpolicy.com',
    role: RoleType.SALES_AGENT,
  };

  const mockProposal = {
    id: 'prop-123',
    proposalNumber: 'PROP-1234',
    quotationId: 'quote-123',
    contactId: 'contact-123',
    status: ProposalStatus.DRAFT,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProposalsController],
      providers: [
        {
          provide: ProposalService,
          useValue: {
            getProposals: jest.fn().mockResolvedValue([mockProposal]),
            getProposalDetails: jest.fn().mockResolvedValue(mockProposal),
            createProposal: jest.fn().mockResolvedValue(mockProposal),
            attachDocument: jest.fn().mockResolvedValue(mockProposal),
            submitProposal: jest.fn().mockResolvedValue({
              ...mockProposal,
              status: ProposalStatus.SUBMITTED,
            }),
            reviewProposal: jest.fn().mockResolvedValue({
              proposal: mockProposal,
              message: 'APPROVED',
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<ProposalsController>(ProposalsController);
    service = module.get<ProposalService>(ProposalService);
  });

  describe('Proposals API', () => {
    it('should create proposal draft', async () => {
      const result = await controller.createProposal('quote-123', mockUser);
      expect(result).toEqual(mockProposal);
      expect(service.createProposal).toHaveBeenCalledWith(
        'quote-123',
        mockUser.id,
      );
    });

    it('should submit proposal', async () => {
      const result = await controller.submitProposal('prop-123', mockUser);
      expect(result.status).toBe(ProposalStatus.SUBMITTED);
      expect(service.submitProposal).toHaveBeenCalledWith(
        'prop-123',
        mockUser.id,
      );
    });
  });
});
