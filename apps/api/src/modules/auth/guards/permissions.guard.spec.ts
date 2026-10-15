import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard canonical permission compatibility', () => {
  const handler = () => undefined;
  const controller = class {};
  let requiredPermissions: string[] | undefined;
  let permissions: string[];
  let guard: PermissionsGuard;

  const context = () =>
    ({
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'user-1', permissions } }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    requiredPermissions = undefined;
    permissions = [];
    const reflector = {
      getAllAndOverride: jest.fn(() => requiredPermissions),
    };
    guard = new PermissionsGuard(reflector as any);
  });

  it('allows REPORT_VIEW when canonical report:read is granted', () => {
    requiredPermissions = ['REPORT_VIEW'];
    permissions = ['report:read'];

    expect(guard.canActivate(context())).toBe(true);
  });

  it('allows REPORT_CREATE when canonical report:create is granted', () => {
    requiredPermissions = ['REPORT_CREATE'];
    permissions = ['report:create'];

    expect(guard.canActivate(context())).toBe(true);
  });

  it('allows report export only when canonical report:export is granted', () => {
    requiredPermissions = ['REPORT_EXECUTE'];
    permissions = ['report:export'];

    expect(guard.canActivate(context())).toBe(true);
  });

  it('allows report scheduling only with the dedicated report:schedule grant', () => {
    requiredPermissions = ['REPORT_SCHEDULE'];
    permissions = ['report:schedule'];

    expect(guard.canActivate(context())).toBe(true);
  });

  it('does not treat report creation as report scheduling permission', () => {
    requiredPermissions = ['REPORT_SCHEDULE'];
    permissions = ['report:create'];

    expect(() => guard.canActivate(context())).toThrow(ForbiddenException);
  });

  it('does not grant reporting access when the actor has unrelated permissions', () => {
    requiredPermissions = ['REPORT_VIEW'];
    permissions = ['lead:read', 'policy:read'];

    expect(() => guard.canActivate(context())).toThrow(ForbiddenException);
  });

  it('honors the explicit platform wildcard grant', () => {
    requiredPermissions = ['REPORT_VIEW', 'REPORT_CREATE'];
    permissions = ['*'];

    expect(guard.canActivate(context())).toBe(true);
  });
});
