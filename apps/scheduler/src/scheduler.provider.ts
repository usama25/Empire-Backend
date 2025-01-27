import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';
import { TransporterCmds } from '@lib/fabzen-common/types';

export class SchedulerProvider extends MicroserviceProvider {
  scheduleEndGame(tableId: string, endAt: string) {
    this._sendRequest(TransporterCmds.SCHEDULE_END_GAME, {
      tableId,
      endAt,
    });
  }

  scheduleEndRound(
    tournamentId: string,
    roundNo: number,
    endAt: string,
    tableId?: string,
  ) {
    this._sendRequest(TransporterCmds.SCHEDULE_END_ROUND, {
      tournamentId,
      roundNo,
      tableId,
      endAt,
    });
  }

  scheduleStartTournament(tournamentId: string, startAt: string) {
    this._sendRequest(TransporterCmds.SCHEDULE_START_TOURNAMENT, {
      tournamentId,
      startAt,
    });
  }

  scheduleTournamentNotifications(
    tournamentId: string,
    index: number,
    triggerAt: string,
  ) {
    this._sendRequest(TransporterCmds.SCHEDULE_TOURNAMENT_NOTIFIACTIONS, {
      tournamentId,
      index,
      triggerAt,
    });
  }
}
