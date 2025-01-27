import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { AuthenticatedUser, JwtPayload } from '@lib/fabzen-common/types';
import { config } from '@lib/fabzen-common/configuration';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const { algorithm, publicKey, ignoreExpiration } = config.auth.jwt;
    super({
      // docs: https://github.com/mikenicholson/passport-jwt#configure-strategy
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: [algorithm],
      secretOrKey: publicKey,
      ignoreExpiration,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.userId,
      roles: payload.roles,
    };
  }
}
