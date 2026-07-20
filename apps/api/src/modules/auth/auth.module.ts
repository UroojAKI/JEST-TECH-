import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret') as string,
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [AuthService, TokenService, JwtStrategy, PermissionsGuard],

  exports: [AuthService, TokenService, PassportModule, PermissionsGuard],
})
export class AuthModule {}
