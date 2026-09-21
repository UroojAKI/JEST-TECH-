import { ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ANY_AUTHENTICATED_ROLE_KEY } from '../decorators/any-authenticated.decorator';

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

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ANY_AUTHENTICATED_ROLE_KEY) return false;
      return undefined;
    });
  });

  it('allows the exact required role', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ROLES_KEY) return ['CLAIMS_OFFICER'];
      return false;
    });
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor({ role: 'CLAIMS_OFFICER' }))).toBe(
      true,
    );
  });

  it('denies a different employee role', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ROLES_KEY) return ['BACK_OFFICE'];
      return false;
    });
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextFor({ role: 'AGENT' }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows explicitly defined global administrative roles', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ROLES_KEY) return ['BACK_OFFICE'];
      return false;
    });
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor({ role: 'ADMIN' }))).toBe(true);
    expect(guard.canActivate(contextFor({ role: RoleType.ADMIN }))).toBe(true);
  });

  it('denies protected routes when authentication did not populate a user', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ROLES_KEY) return ['ADMIN'];
      return false;
    });
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor(undefined))).toBe(false);
  });

  it('fails closed when endpoint declares neither roles nor anyAuthenticated', () => {
    reflector.getAllAndOverride.mockImplementation(() => undefined);
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextFor({ role: 'AGENT' }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows routes with explicit AnyAuthenticatedRole decorator', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ANY_AUTHENTICATED_ROLE_KEY) return true;
      return undefined;
    });
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor({ role: 'AGENT' }))).toBe(true);
  });
});
