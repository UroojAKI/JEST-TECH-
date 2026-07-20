import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigurationService } from '../../platform/configuration/configuration.service';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { Request } from 'express';

const cookieExtractor = (req: Request) => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies['access_token'];
  }
  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigurationService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    permissions?: string[];
  }) {
    // The object returned here is attached to request.user by Passport
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions || [],
    };
  }
}
