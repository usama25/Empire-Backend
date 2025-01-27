import { MobileNumber, Otp } from '@lib/fabzen-common/types';

import { AuthEntity } from '@lib/fabzen-common/entities';
import { BuildInfoDto } from '@lib/fabzen-common/dtos/user.common.dto';
import { UpdateRolesRequestDto } from 'apps/rest-api/src/subroutes/auth/auth.dto';

export abstract class AuthRepository {
  abstract getAuthByMobileNumber(
    mobileNumber: MobileNumber,
  ): Promise<AuthEntity | undefined>;

  abstract updateOtp(
    mobileNumber: MobileNumber,
    otp: Otp,
    build?: BuildInfoDto,
  ): Promise<void>;
  abstract createAuth(authEntity: AuthEntity): Promise<void>;
  abstract attachUserId(
    mobileNumber: MobileNumber,
    userId: string,
  ): Promise<void>;
  abstract updateRoles(body: UpdateRolesRequestDto): Promise<void>;
}

export const createMockAuthRepository = (): AuthRepository => ({
  getAuthByMobileNumber: jest.fn(),
  updateOtp: jest.fn(),
  createAuth: jest.fn(),
  attachUserId: jest.fn(),
  updateRoles: jest.fn(),
});
