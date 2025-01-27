import { Socket } from 'socket.io';
import { AuthenticatedUser } from './auth.types';

export class AuthenticatedSocket extends Socket {
  public user: AuthenticatedUser;
}
