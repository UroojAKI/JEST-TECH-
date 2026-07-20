import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from './workflow-engine.service';
import { PrismaService } from '../../../../database/prisma.service';
import { WorkflowAdapterRegistry } from './workflow-adapter-registry.service';
import { WorkflowStateMachine } from './workflow-state-machine.service';
import { AuditService } from '../../audit/services/audit.service';
import { NotificationDispatcher } from '../../notifications/services/notification-dispatcher.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;
  let prisma: PrismaService;
  let registry: WorkflowAdapterRegistry;
  let stateMachine: WorkflowStateMachine;

  const mockPrisma = {
    workflowTransition: {
      findUnique: jest.fn(),
    },
    workflowState: {
      findUnique: jest.fn(),
    },
    workflowAssignment: {
      findFirst: jest.fn(),
    },
    workflowHistory: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  const mockRegistry = {
    getAdapter: jest.fn(),
  };

  const mockStateMachine = {
    evaluateConditions: jest.fn().mockReturnValue(true),
    validateTransition: jest.fn().mockReturnValue(true),
  };

  const mockAudit = {
    createLog: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotification = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WorkflowAdapterRegistry, useValue: mockRegistry },
        { provide: WorkflowStateMachine, useValue: mockStateMachine },
        { provide: AuditService, useValue: mockAudit },
        { provide: NotificationDispatcher, useValue: mockNotification },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
    prisma = module.get<PrismaService>(PrismaService);
    registry = module.get<WorkflowAdapterRegistry>(WorkflowAdapterRegistry);
    stateMachine = module.get<WorkflowStateMachine>(WorkflowStateMachine);

    jest.clearAllMocks();
  });

  it('should transition entity state when valid', async () => {
    const transitionId = 't1';
    const entityId = 'e1';
    const userId = 'u1';

    const mockTransition = {
      id: transitionId,
      code: 'SUBMIT_PROP',
      fromStateId: 's1',
      toStateId: 's2',
      conditions: null,
      fromState: { code: 'DRAFT' },
      toState: { code: 'SUBMITTED' },
      workflow: { id: 'w1', module: 'PROPOSALS' },
      assignments: [],
      actions: [],
    };

    mockPrisma.workflowTransition.findUnique.mockResolvedValue(mockTransition);

    const mockAdapter = {
      supports: jest.fn().mockReturnValue(true),
      getCurrentState: jest.fn().mockResolvedValue('DRAFT'),
      updateState: jest.fn().mockResolvedValue(undefined),
      getVariables: jest.fn().mockResolvedValue({}),
    };

    mockRegistry.getAdapter.mockReturnValue(mockAdapter);
    jest.spyOn(mockStateMachine, 'validateTransition').mockReturnValue(true);

    await service.transition(
      'PROPOSAL',
      entityId,
      transitionId,
      userId,
      'Test comments',
    );

    expect(mockAdapter.getCurrentState).toHaveBeenCalledWith(entityId);
    expect(mockAdapter.updateState).toHaveBeenCalledWith(
      entityId,
      'SUBMITTED',
      expect.any(Object),
    );
    expect(mockPrisma.workflowHistory.create).toHaveBeenCalledWith({
      data: {
        workflowId: 'w1',
        workflowVersion: undefined,
        entityType: 'PROPOSAL',
        entityId,
        fromStateId: 's1',
        toStateId: 's2',
        performedById: userId,
        comments: 'Test comments',
        variables: {},
      },
    });
  });

  it('should throw BadRequestException if current state does not match fromState', async () => {
    const transitionId = 't1';
    const entityId = 'e1';
    const userId = 'u1';

    const mockTransition = {
      id: transitionId,
      code: 'SUBMIT_PROP',
      fromStateId: 's1',
      toStateId: 's2',
      conditions: null,
      fromState: { code: 'DRAFT' },
      toState: { code: 'SUBMITTED' },
      workflow: { id: 'w1', module: 'PROPOSALS' },
      assignments: [],
      actions: [],
    };

    mockPrisma.workflowTransition.findUnique.mockResolvedValue(mockTransition);

    const mockAdapter = {
      supports: jest.fn().mockReturnValue(true),
      getCurrentState: jest.fn().mockResolvedValue('SUBMITTED'),
      updateState: jest.fn().mockResolvedValue(undefined),
      getVariables: jest.fn().mockResolvedValue({}),
    };

    mockRegistry.getAdapter.mockReturnValue(mockAdapter);
    jest.spyOn(mockStateMachine, 'validateTransition').mockReturnValue(false);

    await expect(
      service.transition(
        'PROPOSAL',
        entityId,
        transitionId,
        userId,
        'Test comments',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
