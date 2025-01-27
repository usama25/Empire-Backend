import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { Controller, UseInterceptors } from '@nestjs/common';

import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { TransporterCmds } from '@lib/fabzen-common/types';

import { CbrGameplayGateway } from './cbr-gameplay.gateway';
import { CBLiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';
import { MessageData } from '@lib/fabzen-common/decorators';
import { CbrGameplayService } from './cbr-gameplay.service';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class CbrGameplayTransporterController {
  constructor(
    private readonly cbrGameplayGateway: CbrGameplayGateway,
    private readonly cbrGameplayService: CbrGameplayService,
  ) {}

  @EventPattern(TransporterCmds.BROADCAST_ONLINE_USER_COUNT)
  broadcastOnlineUserCount() {
    this.cbrGameplayGateway.broadcastOnlineUserCount();
  }

  @MessagePattern(TransporterCmds.GET_CB_LIVE_GAMES)
  async getGameTables(@MessageData() cbrLiveGamesRequest: CBLiveGamesRequest) {
    return await this.cbrGameplayService.getGameTables(cbrLiveGamesRequest);
  }

  @MessagePattern(TransporterCmds.CLEAR_CB_STUCK_TABLE)
  async clearStuckTable(@MessageData() { tableId }: any) {
    return await this.cbrGameplayService.clearTable(tableId);
  }
}
