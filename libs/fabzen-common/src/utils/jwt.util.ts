import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';

import { JwtPayload } from '../types';
import { AuthenticatedSocket } from '../types/socket.types';

export const verifyJwtTokenInSocketIo = (
  client: Socket,
): boolean | any | Promise<boolean | any> => {
  const { handshake } = client;

  const bearerToken = handshake.auth?.token ?? handshake.headers?.authorization;

  const token = bearerToken?.split(' ')[1] ?? bearerToken;
  if (!token) {
    throw new UnauthorizedException('WS JWT Guard error: No token provided');
  }
  try {
    const payload = new JwtService().verify<JwtPayload>(token, {
      secret: config.auth.jwt.publicKey as string,
      algorithms: [config.auth.jwt.algorithm],
      ignoreExpiration: config.auth.jwt.ignoreExpiration,
    });
    const { userId, roles } = payload;
    (client as AuthenticatedSocket).user = { userId, roles };
    return true;
  } catch (error) {
    throw new UnauthorizedException(`WS JWT Guard error: ${error}`);
  }
};
