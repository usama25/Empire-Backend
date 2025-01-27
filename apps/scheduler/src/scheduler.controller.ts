import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { MessageData } from '@lib/fabzen-common/decorators';
import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';
import { TransporterCmds } from '@lib/fabzen-common/types';

import { SchedulerService } from './scheduler.service';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @MessagePattern(TransporterCmds.SCHEDULE_END_GAME)
  scheduleEndGame(
    @MessageData()
    { tableId, endAt }: { tableId: string; endAt: string },
  ) {
    this.schedulerService.scheduleEndGame(tableId, endAt);
  }

  @MessagePattern(TransporterCmds.SCHEDULE_END_ROUND)
  scheduleEndRound(
    @MessageData()
    {
      tournamentId,
      roundNo,
      tableId,
      endAt,
    }: {
      tournamentId: string;
      roundNo: number;
      tableId: string | undefined;
      endAt: string;
    },
  ) {
    this.schedulerService.scheduleEndRound(
      tournamentId,
      roundNo,
      tableId,
      endAt,
    );
  }

  @MessagePattern(TransporterCmds.SCHEDULE_START_TOURNAMENT)
  scheduleStartTournament(
    @MessageData()
    { tournamentId, startAt }: { tournamentId: string; startAt: string },
  ) {
    this.schedulerService.scheduleStartTournament(tournamentId, startAt);
  }

  @MessagePattern(TransporterCmds.SCHEDULE_TOURNAMENT_NOTIFIACTIONS)
  scheduleTournamentNotifications(
    @MessageData()
    {
      tournamentId,
      index,
      triggerAt,
    }: {
      tournamentId: string;
      index: number;
      triggerAt: string;
    },
  ) {
    this.schedulerService.scheduleTournamentNotifications(
      tournamentId,
      index,
      triggerAt,
    );
  }
}
