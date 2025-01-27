import { BuildInfoDto } from '@lib/fabzen-common/dtos/user.common.dto';
import { MobileNumber } from '@lib/fabzen-common/types';
import { UpdateUserDto } from 'apps/user/src/infrastructure/controllers/dtos/user.transporter.dto';

export abstract class UserRepository {
  abstract createOrUpdateUser(
    mobileNumber: MobileNumber,
    build: BuildInfoDto,
  ): Promise<string>;

  abstract updateDeviceInfo(
    updateDeviceInfo: UpdateUserDto,
  ): Promise<UpdateUserDto>;

  abstract checkIfFirstLogin(mobileNumber: MobileNumber): Promise<boolean>;
}

export const createMockUserRepository = (): UserRepository => ({
  createOrUpdateUser: jest.fn(),
  updateDeviceInfo: jest.fn(),
  checkIfFirstLogin: jest.fn(),
});
