import { ForbiddenException } from '@nestjs/common';

import { createMockRemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

import { SecurityUseCases } from './security.use-cases';
import { createMockIpRegionResolver } from '../interfaces';

describe('Security Use Cases', () => {
  const mockIpRegionResolver = createMockIpRegionResolver();
  const mockRemoteConfigService = createMockRemoteConfigService();
  const securityUseCases = new SecurityUseCases(
    mockIpRegionResolver,
    mockRemoteConfigService,
  );
  it('Allowed State', () => {
    (mockIpRegionResolver.getStateFromIpAddress as jest.Mock).mockReturnValue(
      'state',
    );
    (mockRemoteConfigService.getRestrictedStates as jest.Mock).mockReturnValue(
      [],
    );

    expect(
      securityUseCases.rejectRestrictedLocation('ip'),
    ).resolves.toBeUndefined();
  });

  it('Banned State', () => {
    (mockIpRegionResolver.getStateFromIpAddress as jest.Mock).mockReturnValue(
      'state',
    );
    (mockRemoteConfigService.getRestrictedStates as jest.Mock).mockReturnValue([
      'state',
    ]);

    expect(securityUseCases.rejectRestrictedLocation('ip')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
