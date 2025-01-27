import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { MobileNumber, TransporterProviders } from '@lib/fabzen-common/types';

import { UserProvider } from 'apps/user/src/user.provider';
import { UserRepository } from '../../domain/interfaces';
import { BuildInfoDto } from '@lib/fabzen-common/dtos/user.common.dto';
import { UpdateUserDto } from 'apps/user/src/infrastructure/controllers/dtos/user.transporter.dto';

@Injectable()
export class MicroserviceUserRepository implements UserRepository {
  private readonly logger = new Logger(MicroserviceUserRepository.name);
  private readonly userProvider: UserProvider;

  constructor(
    @Inject(TransporterProviders.USER_SERVICE) private userClient: ClientProxy,
  ) {
    this.userProvider = new UserProvider(this.userClient);
  }

  async createOrUpdateUser(
    mobileNumber: MobileNumber,
    build: BuildInfoDto,
  ): Promise<string> {
    return await this.userProvider.createOrUpdateUser(mobileNumber, build);
  }

  async updateDeviceInfo(
    updateDeviceInfo: UpdateUserDto,
  ): Promise<UpdateUserDto> {
    await this.userProvider.updateDeviceInfo(updateDeviceInfo);

    return updateDeviceInfo;
  }

  async checkIfFirstLogin(mobileNumber: MobileNumber): Promise<boolean> {
    return await this.userProvider.checkIfFirstLogin(mobileNumber);
  }
}
