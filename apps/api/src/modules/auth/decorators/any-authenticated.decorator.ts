import { SetMetadata } from '@nestjs/common';
export const ANY_AUTHENTICATED_ROLE_KEY = 'anyAuthenticatedRole';
export const AnyAuthenticatedRole = () =>
  SetMetadata(ANY_AUTHENTICATED_ROLE_KEY, true);
