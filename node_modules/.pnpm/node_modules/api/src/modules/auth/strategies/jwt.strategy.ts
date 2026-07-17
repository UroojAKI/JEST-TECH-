import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Non-null assertion is safe: Joi validation at startup guarantees
      // JWT_SECRET is present before the application binds to a port.
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    // The object returned here is attached to request.user by Passport
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
