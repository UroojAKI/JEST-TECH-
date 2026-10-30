import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

function createMockContext(user: any): ExecutionContext {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('allows access when no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ permissions: [] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows super-admin with wildcard * to access any permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['lead:delete']);
    const context = createMockContext({
      permissions: ['*'],
      role: 'ADMIN',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows super-admin with isSuperAdmin=true flag', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system:configure']);
    const context = createMockContext({
      permissions: [],
      isSuperAdmin: true,
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows user with exact required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['lead:read']);
    const context = createMockContext({
      permissions: ['lead:read'],
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('resolves permission aliases (e.g., REPORT_VIEW <-> report:read)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['REPORT_VIEW']);
    const context = createMockContext({
      permissions: ['report:read'],
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when required permission is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['lead:delete']);
    const context = createMockContext({
      permissions: ['lead:read', 'lead:create'],
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user has no permissions assigned', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['lead:read']);
    const context = createMockContext({ permissions: null });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
