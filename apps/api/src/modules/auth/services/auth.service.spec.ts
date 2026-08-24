// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../../users/services/users.service';
import { TokenService } from './token.service';

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Record<string, jest.Mock>;
  let tokenService: Record<string, jest.Mock>;

  const mockUser = {
    id: 'user-id-1',
    email: 'test@jest.com',
    firstName: 'Test',
    lastName: 'User',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hash',
    role: { code: 'SALES_AGENT', id: 'role-id', permissions: [] },
    // auth.service.ts checks user.status (not isActive) — must be 'ACTIVE'
    // to reach the password verification step
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    usersService = {
      findByEmailForAuth: jest.fn(),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
      storeRefreshToken: jest.fn().mockResolvedValue(undefined),
      findActiveRefreshTokens: jest.fn().mockResolvedValue([]),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeAllUserRefreshTokens: jest.fn().mockResolvedValue(undefined),
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    tokenService = {
      generateAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
      generateRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token'),
      verifyRefreshToken: jest.fn().mockResolvedValue({ email: 'test@jest.com', sub: 'user-id-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: TokenService, useValue: tokenService },
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

    it('should return access token and user data on valid login', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@jest.com',
        password: 'password',
      });

      expect(usersService.findByEmailForAuth).toHaveBeenCalledWith('test@jest.com');
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
