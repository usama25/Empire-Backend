import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { config } from '@lib/fabzen-common/configuration';
import { JwtPayload } from '@lib/fabzen-common/types';

export function verifyJwtTokenInSocketIo(client: any): boolean {
  const { handshake } = client;
  const bearerToken = handshake.auth?.token ?? handshake.headers?.authorization;

  const token = bearerToken?.split(' ')[1] ?? bearerToken;
  if (!token) {
    throw new UnauthorizedException('WS JWT Guard error: No token provided');
  }
  try {
    const payload = new JwtService().verify<JwtPayload>(token, {
      secret: config.auth.jwt.publicKey,
      algorithms: [config.auth.jwt.algorithm],
      ignoreExpiration: config.auth.jwt.ignoreExpiration,
    });
    const { userId, roles } = payload;
    client.user = { userId, roles };
    return true;
  } catch (error) {
    throw new UnauthorizedException(`WS JWT Guard error: ${error}`);
  }
}

export function disconnectUnauthorizedClient(client: any) {
  try {
    verifyJwtTokenInSocketIo(client);
  } catch ({ message }) {
    client.emit('exception', { message });
    client.disconnect();
  }
}
