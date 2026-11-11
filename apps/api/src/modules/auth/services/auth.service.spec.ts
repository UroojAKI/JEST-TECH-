import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../../users/services/users.service';
import { TokenService } from './token.service';
import { PrismaService } from '../../../database/prisma.service';

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Record<string, jest.Mock>;
  let tokenService: Record<string, jest.Mock>;
  let prismaMock: any;

  const mockUser = {
    id: 'user-id-1',
    email: 'test@jest.com',
    firstName: 'Test',
    lastName: 'User',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hash',
    role: { code: 'AGENT', type: 'AGENT', id: 'role-id', permissions: [] },
    organizationId: 'org-test-123',
    companyId: 'org-test-123',
    authVersion: 1,
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    failedLoginWindowStartedAt: null,
    lockedUntil: null,
  };

  beforeEach(async () => {
    usersService = {
      findByEmailForAuth: jest.fn(),
      getPrimaryOrganizationId: jest.fn().mockResolvedValue('org-test-123'),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
      storeRefreshToken: jest.fn().mockResolvedValue(undefined),
      findActiveRefreshTokens: jest.fn().mockResolvedValue([]),
      findUserRefreshTokens: jest.fn().mockResolvedValue([]),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeAllUserRefreshTokens: jest.fn().mockResolvedValue(undefined),
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    tokenService = {
      generateAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
      generateRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token'),
      verifyRefreshToken: jest
        .fn()
        .mockResolvedValue({ email: 'test@jest.com', sub: 'user-id-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: TokenService, useValue: tokenService },
        {
          provide: PrismaService,
          useValue: (prismaMock = {
            $transaction: jest.fn(async (operation: any) => operation({
              user: {
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                update: jest.fn().mockResolvedValue({ failedLoginAttempts: 1 }),
              },
              refreshToken: {
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                update: jest.fn().mockResolvedValue({}),
                create: jest.fn().mockResolvedValue({ id: 'new-refresh-id' }),
              },
              auditLog: { create: jest.fn().mockResolvedValue({}) },
            })),
            user: { update: jest.fn().mockResolvedValue({}) },
            refreshToken: {
              updateMany: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
          }),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: unknown) => {
              const config: Record<string, unknown> = {
                'jwt.refreshExpiresIn': '30d',
                'jwt.expiresIn': '15m',
              };
              return config[key] ?? defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('refresh', () => {
    it('rotates a valid refresh token using an interactive transaction', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(mockUser);
      const tokenHash = crypto.createHash('sha256').update('mock-refresh-token').digest('hex');
      usersService.findUserRefreshTokens.mockResolvedValue([{
        id: 'refresh-record-1',
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }]);

      const result = await service.refresh('mock-refresh-token');

      expect(result.accessToken).toBe('mock-access-token');
      expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('rejects a refresh token if another request already rotated it', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(mockUser);
      const tokenHash = crypto.createHash('sha256').update('mock-refresh-token').digest('hex');
      usersService.findUserRefreshTokens.mockResolvedValue([{
        id: 'refresh-record-1',
        tokenHash,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }]);
      prismaMock.$transaction.mockImplementation(async (operation: any) => operation({
        refreshToken: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn(),
        },
      }));

      await expect(service.refresh('mock-refresh-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException when user does not exist', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@test.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@jest.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a valid password while the account lockout window is active', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        ...mockUser,
        lockedUntil: new Date(Date.now() + 60_000),
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ email: 'test@jest.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return access token and user data on valid login', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@jest.com',
        password: 'password',
      });

      expect(usersService.findByEmailForAuth).toHaveBeenCalledWith(
        'test@jest.com',
      );
      expect(result.accessToken).toBe('mock-access-token');
    });

    it('login error messages do not reveal whether email or password was wrong', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(null);

      try {
        await service.login({
          email: 'unknown@test.com',
          password: 'password',
        });
        fail('Should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        expect(e.message).toBe('Invalid email or password');
        expect(e.message).not.toContain('email not found');
        expect(e.message).not.toContain('user not found');
      }
    });
  });
});
