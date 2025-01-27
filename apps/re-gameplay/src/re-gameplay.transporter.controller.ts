import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { Controller, UseInterceptors } from '@nestjs/common';

import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { WaitingTableQueueService } from './services/queue';
import { ReGameplayGateway } from './re-gameplay.gateway';
import { ReGameplayController } from './re-gameplay.controller';
import { RELiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';
import { MessageData } from '@lib/fabzen-common/decorators';
import { ReGameplayService } from './re-gameplay.service';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class ReGameplayTransporterController {
  constructor(
    private readonly remoteConfigService: RemoteConfigService,
    private readonly waitingTableQueueService: WaitingTableQueueService,
    private readonly reGameplayGateway: ReGameplayGateway,
    private readonly reGameplayController: ReGameplayController,
    private readonly reGameplayService: ReGameplayService,
  ) {}

  @MessagePattern(TransporterCmds.RE_MATCH_GAMES)
  async matchReGames() {
    const tableTypes = this.remoteConfigService.getReTableInfos();
    for (const tableType of tableTypes) {
      this.waitingTableQueueService.matchRe(tableType);
    }
  }

  @EventPattern(TransporterCmds.BROADCAST_ONLINE_USER_COUNT)
  broadcastOnlineUserCount() {
    this.reGameplayGateway.broadcastOnlineUserCount();
  }

  @MessagePattern(TransporterCmds.GET_RE_LIVE_GAMES)
  async getGameTables(@MessageData() reLiveGamesRequest: RELiveGamesRequest) {
    return await this.reGameplayController.getGameTables(reLiveGamesRequest);
  }

  @MessagePattern(TransporterCmds.RE_CHECK_IF_RECONNECTED)
  async checkIfReconnected(
    @MessageData()
    { userId }: { userId: string },
  ) {
    return await this.reGameplayService.checkIfReconnected(userId);
  }

  @MessagePattern(TransporterCmds.CLEAR_RE_STUCK_TABLE)
  async clearStuckTable(@MessageData() { tableId }: any) {
    return await this.reGameplayService.clearTable(tableId);
  }
}
