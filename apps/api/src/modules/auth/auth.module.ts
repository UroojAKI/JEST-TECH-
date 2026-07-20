import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../platform/configuration/configuration.module';
import { ConfigurationService } from '../platform/configuration/configuration.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';

import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [
    UsersModule,

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports: [ConfigurationModule],
      inject: [ConfigurationService],
      useFactory: (config: ConfigurationService) => ({
        secret: config.jwtSecret,
        signOptions: {
          expiresIn: config.jwtExpiresIn as any,
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [AuthService, TokenService, JwtStrategy, PermissionsGuard],

  exports: [AuthService, TokenService, PassportModule, PermissionsGuard],
})
export class AuthModule {}
