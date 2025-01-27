import * as dayjs from 'dayjs';

export enum Role {
  player = 'player',
  admin = 'admin',
  support = 'support',
  finance = 'finance',
}

export type AuthenticatedUser = {
  userId: string;
  roles: Role[];
};

export type JwtPayload = {
  userId: string; // subject = userId
  roles: Role[];
};

export type Otp = {
  code: string;
  used: boolean;
  sentCount: number;
  lastSentAt: dayjs.Dayjs;
  failedAttempts: number;
  expiresAt: dayjs.Dayjs;
};

export type MobileNumber = {
  countryCode: string;
  number: string;
};
