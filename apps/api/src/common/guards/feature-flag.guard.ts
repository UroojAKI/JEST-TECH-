import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { FeatureFlags } from '../../config/features.config';

export const FEATURE_FLAG_KEY = 'feature_flag';

/**
 * Decorator to require a specific feature flag to be active for a route.
 *
 * Usage: @RequireFeatureFlag('REPORTS')
 */
export const RequireFeatureFlag = (flagName: keyof typeof FeatureFlags) =>
  SetMetadata(FEATURE_FLAG_KEY, flagName);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const flagName = this.reflector.getAllAndOverride<keyof typeof FeatureFlags>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!flagName) {
      return true;
    }

    const isEnabled = FeatureFlags[flagName];
    if (!isEnabled) {
      throw new BadRequestException(`Feature '${flagName}' is currently disabled.`);
    }

    return true;
  }
}
