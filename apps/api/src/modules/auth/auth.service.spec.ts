// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './services/auth.service';
import { any } from '../../users/services/user.service';
import { TokenService } from './services/token.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<any>;
  let tokenService: jest.Mocked<TokenService>;
  let configService: jest.Mocked<ConfigService>;

  const mockany = {
    findByEmailForAuth: jest.fn(),
    updateLastLogin: jest.fn(),
    storeRefreshToken: jest.fn(),
    createAuditLog: jest.fn(),
    findActiveRefreshTokens: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllUserRefreshTokens: jest.fn(),
  };

  const mockTokenService = {
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: any, useValue: mockany },
        { provide: TokenService, useValue: mockTokenService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(any);
    tokenService = module.get(TokenService);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password123' };
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
      status: 'ACTIVE',
      firstName: 'Test',
      lastName: 'User',
      role: {
        code: 'SALES_AGENT',
        permissions: [{ permission: { code: 'READ_LEAD' } }],
      },
    };

    it('should return access_token and refresh_token on valid credentials', async () => {
      mockany.findByEmailForAuth.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockTokenService.generateAccessToken.mockResolvedValue('access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue('refresh-token');
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'jwt.expiresIn') return '15m';
        if (key === 'jwt.refreshExpiresIn') return '30d';
      });
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: '15m',
        user: {
          id: 'user-1',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          role: 'SALES_AGENT',
        },
      });
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      mockany.findByEmailForAuth.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockany.findByEmailForAuth.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException on inactive/locked user', async () => {
      mockany.findByEmailForAuth.mockResolvedValue({ ...mockUser, status: 'INACTIVE' });

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: {
        code: 'SALES_AGENT',
        permissions: [],
      },
    };

    it('should return new access_token on valid refresh token', async () => {
      mockTokenService.verifyRefreshToken.mockResolvedValue({ email: 'test@example.com' });
      mockany.findByEmailForAuth.mockResolvedValue(mockUser);
      mockany.findActiveRefreshTokens.mockResolvedValue([
        { id: 'token-1', tokenHash: 'hashed-token' },
      ]);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockTokenService.generateAccessToken.mockResolvedValue('new-access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue('new-refresh-token');
      mockConfigService.get.mockReturnValue('15m');

      const result = await service.refresh('old-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException on invalid/expired token', async () => {
      mockTokenService.verifyRefreshToken.mockRejectedValue(new Error('Invalid token'));

      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete refresh token from DB on valid call', async () => {
      await service.logout('user-1');
      expect(mockany.revokeAllUserRefreshTokens).toHaveBeenCalledWith('user-1');
    });
  });
});
