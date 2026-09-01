import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

function contextFor(user: any): any {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as any;

  beforeEach(() => jest.clearAllMocks());

  it('allows the exact required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['CLAIMS_OFFICER']);
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(
        contextFor({ role: 'CLAIMS_OFFICER' }),
      ),
    ).toBe(true);
  });

  it('denies a different employee role', () => {
    reflector.getAllAndOverride.mockReturnValue(['CLAIMS_OFFICER']);
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(contextFor({ role: 'SALES_AGENT' })),
    ).toThrow(ForbiddenException);
  });

  it('allows explicitly defined global administrative roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['CLAIMS_OFFICER']);
    const guard = new RolesGuard(reflector);

    for (const role of [
      'SUPER_ADMIN',
      'ADMIN',
      'SYSTEM_ADMINISTRATOR',
      'MD_CEO',
    ]) {
      expect(guard.canActivate(contextFor({ role }))).toBe(true);
    }
  });

  it('denies protected routes when authentication did not populate a user', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor(undefined))).toBe(false);
  });

  it('allows routes without an explicit role requirement', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });
});
