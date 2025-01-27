import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { MessageData } from '@lib/fabzen-common/decorators';
import { SLGameplayUseCases } from '../../domain/use-cases';
import { SLLiveGamesRequest } from 'apps/rest-api/src/subroutes/admin/admin.dto';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class SLGameTrasporterController {
  constructor(private readonly gameplayUsecase: SLGameplayUseCases) {}

  @MessagePattern(TransporterCmds.SL_CHECK_IF_RECONNECTED)
  async checkIfReconnected(
    @MessageData()
    { userId }: { userId: string },
  ) {
    return await this.gameplayUsecase.checkIfReconnected(userId);
  }

  @MessagePattern(TransporterCmds.GET_SL_LIVE_GAMES)
  async getGameTables(@MessageData() slLiveGamesRequest: SLLiveGamesRequest) {
    return await this.gameplayUsecase.getGameTables(slLiveGamesRequest);
  }
  @MessagePattern(TransporterCmds.CLEAR_SL_STUCK_TABLE)
  async clearStuckTable(@MessageData() { tableId }: { tableId: string }) {
    return await this.gameplayUsecase.clearTable(tableId);
  }
}
