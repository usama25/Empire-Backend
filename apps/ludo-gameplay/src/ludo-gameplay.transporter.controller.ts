import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { Controller, UseInterceptors } from '@nestjs/common';

import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { EventData, MessageData } from '@lib/fabzen-common/decorators';

import { LudoGameplayGateway } from './ludo-gameplay.gateway';
import { LudoGameplayController } from './ludo-gameplay.controller';
import { TournamentChangedEvent } from 'apps/ludo-tournament/src/ludo-tournament.types';
import {
  GetRoundInfoRequest,
  RoundStartEvent,
  TournamentForceTerminatedEvent,
} from './ludo-gameplay.types';
import { LudoGameplayService } from './ludo-gameplay.service';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class LudoGameplayTransporterController {
  constructor(
    private readonly ludoGameplayGateway: LudoGameplayGateway,
    private readonly ludoGameplayController: LudoGameplayController,
    private readonly ludoGameplayService: LudoGameplayService,
  ) {}

  @EventPattern(TransporterCmds.LUDO_END_GAME)
  endGame(
    @EventData()
    { tableId }: { tableId: string },
  ) {
    this.ludoGameplayController.endGame(tableId);
  }

  @EventPattern(TransporterCmds.LUDO_END_ROUND)
  endRound(
    @EventData()
    {
      tournamentId,
      roundNo,
      tableId,
    }: {
      tournamentId: string;
      roundNo: number;
      tableId: string | undefined;
    },
  ) {
    this.ludoGameplayController.endRound(tournamentId, roundNo, tableId);
  }

  @EventPattern(TransporterCmds.LUDO_TOURNAMENT_CHANGED)
  tournamentChanged(
    @EventData()
    {
      tournamentChangedEvent,
    }: {
      tournamentChangedEvent: TournamentChangedEvent;
    },
  ) {
    this.ludoGameplayController.tournamentChanged(tournamentChangedEvent);
  }

  @EventPattern(TransporterCmds.LUDO_TOURNAMENT_CANCELED)
  tournamentCanceled(
    @EventData()
    { tournamentId, reason }: TournamentForceTerminatedEvent,
  ) {
    this.ludoGameplayController.tournamentCanceled(tournamentId, reason);
  }

  @EventPattern(TransporterCmds.LUDO_TOURNAMENT_START_ROUND)
  startRound(
    @EventData()
    { roundStartEvent }: { roundStartEvent: RoundStartEvent },
  ) {
    this.ludoGameplayService.startRound(roundStartEvent);
  }

  @EventPattern(TransporterCmds.LUDO_MATCH_NORMAL_GAMES)
  matchNormalGames(
    @EventData()
    { shouldBroadcastTableList }: { shouldBroadcastTableList: boolean },
  ) {
    this.ludoGameplayController.matchNormalGames(shouldBroadcastTableList);
  }

  @EventPattern(TransporterCmds.BROADCAST_ONLINE_USER_COUNT)
  broadcastOnlineUserCount() {
    this.ludoGameplayGateway.broadcastOnlineUserCount();
  }

  @MessagePattern(TransporterCmds.LUDO_TOURNAMENT_GET_ROUND_PLAYERS)
  async getRoundPlayers(
    @MessageData()
    { tournamentId, roundNo, userId }: GetRoundInfoRequest,
  ) {
    return await this.ludoGameplayService.getRoundPlayers(
      tournamentId,
      roundNo,
      userId,
    );
  }
}
