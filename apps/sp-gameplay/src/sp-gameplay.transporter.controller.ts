import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { Controller, UseInterceptors } from '@nestjs/common';

import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { WaitingTableQueueService } from './services/queue';
import { SpGameplayGateway } from './sp-gameplay.gateway';
import { SpGameplayController } from './sp-gameplay.controller';
import { SPLiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';
import { MessageData } from '@lib/fabzen-common/decorators';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class SPGameplayTransporterController {
  constructor(
    private readonly remoteConfigService: RemoteConfigService,
    private readonly waitingTableQueueService: WaitingTableQueueService,
    private readonly spGameplayGateway: SpGameplayGateway,
    private readonly spGameplayController: SpGameplayController,
  ) {}

  @MessagePattern(TransporterCmds.SP_MATCH_GAMES)
  async matchGames() {
    const tableTypes = this.remoteConfigService.getSpTableInfos();
    for (const tableType of tableTypes) {
      this.waitingTableQueueService.match(tableType);
    }
  }

  @EventPattern(TransporterCmds.BROADCAST_ONLINE_USER_COUNT)
  broadcastOnlineUserCount() {
    this.spGameplayGateway.broadcastOnlineUserCount();
  }

  @MessagePattern(TransporterCmds.GET_SP_LIVE_GAMES)
  async getGameTables(@MessageData() spLiveGamesRequest: SPLiveGamesRequest) {
    return await this.spGameplayController.getGameTables(spLiveGamesRequest);
  }

  @MessagePattern(TransporterCmds.CLEAR_SP_STUCK_TABLE)
  async clearStuckTable(@MessageData() { tableId }: any) {
    return await this.spGameplayController.clearTable(tableId);
  }
}
