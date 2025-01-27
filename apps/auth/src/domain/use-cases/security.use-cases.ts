import { ForbiddenException, Injectable } from '@nestjs/common';

import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { DeviceDto } from '@lib/fabzen-common/dtos/user.common.dto';

import { IpRegionResolver } from '../interfaces';

@Injectable()
export class SecurityUseCases {
  constructor(
    private readonly ipRegionResolver: IpRegionResolver,
    private readonly remoteConfigService: RemoteConfigService,
  ) {}

  async rejectRestrictedLocation(ip: string) {
    const state = await this.ipRegionResolver.getStateFromIpAddress(ip);
    if (this.#isRestricted(state)) {
      throw new ForbiddenException(`${state} in restricted`);
    }
  }

  async rejectBlockedDevice(device: DeviceDto): Promise<boolean> {
    // Dummy Implementation, Will throw Exception if this is blocked device
    return !!device;
  }

  #isRestricted(state: string) {
    const restrictedStates = this.remoteConfigService.getRestrictedStates();
    return restrictedStates.includes(state);
  }
}
