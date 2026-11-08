import { BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService invitation activation', () => {
  const invitation = {
    id: 'invite-1',
    userId: 'user-1',
    email: 'agent@example.com',
    companyId: 'company-1',
    tokenHash: 'hashed-token',
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    revokedAt: null,
  };
  let tx: any;
  let prisma: any;
  let service: UsersService;

  beforeEach(() => {
    tx = {
      userInvitation: {
        findFirst: jest.fn().mockResolvedValue(invitation),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    };
    service = new UsersService({} as any, prisma as any);
  });

  it('activates a pending user and consumes the token atomically', async () => {
    const result = await service.activateInvitation('a'.repeat(32), 'a-secure-password-123');

    expect(result.success).toBe(true);
    expect(tx.userInvitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: invitation.id, consumedAt: null, revokedAt: null }),
      data: expect.objectContaining({ consumedAt: expect.any(Date) }),
    }));
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: invitation.userId,
        email: invitation.email,
        companyId: invitation.companyId,
        status: 'PENDING_VERIFICATION',
      }),
      data: expect.objectContaining({
        status: 'ACTIVE',
        passwordHash: expect.any(String),
        authVersion: { increment: 1 },
      }),
    }));
  });

  it('rejects invalid, expired, revoked or already-consumed tokens', async () => {
    tx.userInvitation.findFirst.mockResolvedValue(null);
    await expect(service.activateInvitation('b'.repeat(32), 'a-secure-password-123'))
      .rejects.toThrow(BadRequestException);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a token claimed concurrently by another activation request', async () => {
    tx.userInvitation.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.activateInvitation('c'.repeat(32), 'a-secure-password-123'))
      .rejects.toThrow(ConflictException);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('rolls back token consumption if the pending account cannot be activated', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.activateInvitation('d'.repeat(32), 'a-secure-password-123'))
      .rejects.toThrow(ConflictException);
    // Prisma interactive transaction rolls back the earlier token claim on throw.
    expect(tx.userInvitation.updateMany).toHaveBeenCalledTimes(1);
  });
});
