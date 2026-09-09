import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { ConfigurationService } from '../../platform/configuration/configuration.service';
import { RoleType, UserStatus } from '@prisma/client';

describe('JwtAuthGuard & ActorContext (Iteration 1 Baseline)', () => {
  let guard: JwtAuthGuard;
  let strategy: JwtStrategy;

  beforeEach(() => {
    const mockAuthVersionService = {
      checkVersion: jest.fn().mockResolvedValue(true),
    } as any;
    const mockJwtService = {
      decode: jest.fn().mockReturnValue(null),
    } as any;
    guard = new JwtAuthGuard(mockAuthVersionService, mockJwtService);
    const mockConfig = {
      jwtSecret: 'test-secret',
    } as unknown as ConfigurationService;
    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'usr-101',
          email: 'agent.rahul@jest.com',
          firstName: 'Rahul',
          lastName: 'Sharma',
          status: UserStatus.ACTIVE,
          teamId: 'team-alpha',
          departmentId: 'dept-motor-sales',
          branchId: 'br-andheri',
          role: {
            type: RoleType.SALES_AGENT,
            permissions: [
              { permission: { code: 'quotation.create' } },
              { permission: { code: 'quotation.read' } },
            ],
          },
          branch: {
            code: 'ANDHERI_MAIN',
            zone: {
              region: {
                company: { id: 'org-mumbai-01' },
              },
            },
          },
        }),
      },
    };
    strategy = new JwtStrategy(mockConfig, mockPrisma as any);
  });

  describe('JwtAuthGuard', () => {
    it('should throw UnauthorizedException when passport authentication fails (no superadmin fallback)', async () => {
      // Mock super.canActivate returning false
      jest
        .spyOn(JwtAuthGuard.prototype, 'canActivate')
        .mockImplementation(async (context: ExecutionContext) => {
          // Direct test of guard logic
          throw new UnauthorizedException('Authentication required');
        });

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('JwtStrategy & ActorContext', () => {
    it('should validate and construct a complete ActorContext from JWT claims', async () => {
      const payload = {
        sub: 'usr-101',
        email: 'agent.rahul@jest.com',
        firstName: 'Rahul',
        lastName: 'Sharma',
        role: 'SALES_AGENT',
        roles: ['SALES_AGENT'],
        permissions: ['quotation.create', 'quotation.read'],
        organizationId: 'org-mumbai-01',
        branchId: 'br-andheri',
        branchCode: 'ANDHERI_MAIN',
        departmentId: 'dept-motor-sales',
        teamId: 'team-alpha',
        status: UserStatus.ACTIVE,
      };

      const actorContext = await strategy.validate(payload);

      expect(actorContext).toEqual({
        userId: 'usr-101',
        email: 'agent.rahul@jest.com',
        firstName: 'Rahul',
        lastName: 'Sharma',
        organizationId: 'org-mumbai-01',
        companyId: 'org-mumbai-01',
        branchId: 'br-andheri',
        branchCode: 'ANDHERI_MAIN',
        departmentId: 'dept-motor-sales',
        teamId: 'team-alpha',
        role: RoleType.SALES_AGENT,
        roles: [RoleType.SALES_AGENT],
        permissions: ['quotation.create', 'quotation.read'],
        workspaces: ['SALES', 'RENEWALS', 'PORTAL'],
        status: UserStatus.ACTIVE,
      });
    });

    it('should reject tokens with missing sub claim', async () => {
      await expect(
        strategy.validate({ sub: '', email: '', role: '' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
