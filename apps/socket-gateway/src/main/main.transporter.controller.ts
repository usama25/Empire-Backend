import { Controller, UseInterceptors } from '@nestjs/common';
import { EventPattern, MessagePattern } from '@nestjs/microservices';

import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { EventData, MessageData } from '@lib/fabzen-common/decorators';

import { MainGateway } from '../gateways';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class MainSocketGatewayTransporterController {
  constructor(private readonly mainGateway: MainGateway) {}

  @EventPattern(TransporterCmds.BROADCAST_ONLINE_USER_COUNT)
  broadcastOnlineUserCount() {
    this.mainGateway.broadcastOnlineUserCount();
  }

  @EventPattern(TransporterCmds.SOCKET_NOTIFICATION_LUDO_TOURNAMENT)
  sendSocketNotificationForLudoTournament(
    @EventData()
    { tournamentId }: { tournamentId: string },
  ) {
    this.mainGateway.sendSocketNotificationForLudoTournament(tournamentId);
  }

  @MessagePattern(TransporterCmds.SOCKET_NOTIFICATION_MATCH_MAKING)
  sendMatchMakingSocketNotification(
    @MessageData()
    { userIds, deepLink }: { userIds: string[]; deepLink: string },
  ) {
    this.mainGateway.sendMatchMakingSocketNotification(userIds, deepLink);
  }
}
