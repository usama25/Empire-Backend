import * as dayjs from 'dayjs';
import * as schedule from 'node-schedule';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { Model } from 'mongoose';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';

import { config } from '@lib/fabzen-common/configuration';
import { TransporterProviders } from '@lib/fabzen-common/types';

import { SocketGatewayProvider } from 'apps/socket-gateway/src/socket-gateway.provider';
import { LudoGameplayProvider } from 'apps/ludo-gameplay/src/ludo-gameplay.provider';
import { SPGameplayProvider } from 'apps/sp-gameplay/src/sp-gameplay.provider';
import { LudoTournamentProvider } from 'apps/ludo-tournament/src/ludo-tournament.provider';
import { CbrGameplayProvider } from 'apps/cbr-gameplay/src/cbr-gameplay.provider';
import { GameRecordProvider } from 'apps/game-record/src/game-record.provider';
import { NotificationProvider } from 'apps/notification/src/notification.provider';
import { User, UserDocument } from '@lib/fabzen-common/mongoose/models';
import { ReGameplayProvider } from 'apps/re-gameplay/src/re-gameplay.provider';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly socketGatewayProvider: SocketGatewayProvider;
  private readonly ludoGameplayProvider: LudoGameplayProvider;
  private readonly ludoTournamentProvider: LudoTournamentProvider;
  private readonly reGameplayProvider: ReGameplayProvider;
  private readonly spGameplayProvider: SPGameplayProvider;
  private readonly cbrGameplayProvider: CbrGameplayProvider;
  private readonly gameRecordProvider: GameRecordProvider;
  private readonly notificationProvider: NotificationProvider;
  private matchingSchedulerCount: number;

  constructor(
    @InjectModel(User.name)
    public userModel: Model<UserDocument>,
    @Inject(TransporterProviders.SOCKET_GATEWAY_SERVICE)
    private socketGatewayClient: ClientProxy,
    @Inject(TransporterProviders.LUDO_GAMEPLAY_SERVICE)
    private ludoGameplayClient: ClientProxy,
    @Inject(TransporterProviders.LUDO_TOURNAMENT_SERVICE)
    private ludoTournamentClient: ClientProxy,
    @Inject(TransporterProviders.RE_GAMEPLAY_SERVICE)
    private reGameplayClient: ClientProxy,
    @Inject(TransporterProviders.SP_GAMEPLAY_SERVICE)
    private spGameplayClient: ClientProxy,
    @Inject(TransporterProviders.CBR_GAMEPLAY_SERVICE)
    private cbrGameplayClient: ClientProxy,
    @Inject(TransporterProviders.RECORD_SERVICE)
    private recordClient: ClientProxy,
    @Inject(TransporterProviders.NOTIFICATION_SERVICE)
    private notificationClient: ClientProxy,
  ) {
    this.socketGatewayProvider = new SocketGatewayProvider(
      this.socketGatewayClient,
    );
    this.ludoGameplayProvider = new LudoGameplayProvider(
      this.ludoGameplayClient,
    );
    this.ludoTournamentProvider = new LudoTournamentProvider(
      this.ludoTournamentClient,
    );
    this.reGameplayProvider = new ReGameplayProvider(this.reGameplayClient);
    this.spGameplayProvider = new SPGameplayProvider(this.spGameplayClient);
    this.cbrGameplayProvider = new CbrGameplayProvider(this.cbrGameplayClient);
    this.gameRecordProvider = new GameRecordProvider(this.recordClient);
    this.notificationProvider = new NotificationProvider(
      this.notificationClient,
    );

    this.matchingSchedulerCount = 0;
    setInterval(() => {
      this.matchNormalGames();
    }, config.ludoGameplay.schedulingIntervalInMs);
    setInterval(() => {
      this.spMatchGames();
    }, config.spGameplay.schedulingIntervalInMs);
    setInterval(() => {
      this.reMatchGames();
    }, config.reGameplay.schedulingIntervalInMs);
  }

  scheduleEndGame(tableId: string, endAt: string) {
    if (dayjs(endAt).isBefore(dayjs())) {
      this.logger.error(`Table ${tableId} already finished`);
      return;
    }
    schedule.scheduleJob(dayjs(endAt).toDate(), () => {
      this.ludoGameplayProvider.endGame(tableId);
    });
  }

  scheduleEndRound(
    tournamentId: string,
    roundNo: number,
    tableId: string | undefined,
    endAt: string,
  ) {
    if (dayjs(endAt).isBefore(dayjs())) {
      this.logger.error(`Table ${tableId} already finished`);
      return;
    }
    schedule.scheduleJob(dayjs(endAt).toDate(), () => {
      this.ludoGameplayProvider.endRound(tournamentId, roundNo, tableId);
    });
  }

  scheduleStartTournament(tournamentId: string, startAt: string) {
    if (dayjs(startAt).isBefore(dayjs())) {
      this.logger.error(`Tournament ${tournamentId} already started`);
      return;
    }
    schedule.scheduleJob(dayjs(startAt).toDate(), () => {
      this.ludoTournamentProvider.startTournament(tournamentId);
    });
  }

  scheduleTournamentNotifications(
    tournamentId: string,
    index: number,
    triggerAt: string,
  ) {
    if (dayjs(triggerAt).isBefore(dayjs())) {
      this.logger.error(`Tournament ${tournamentId} already started`);
      return;
    }
    schedule.scheduleJob(dayjs(triggerAt).toDate(), () => {
      this.notificationProvider.sendTournamentNotification(tournamentId, index);
    });
  }

  async matchNormalGames() {
    const broadcastTableListFrequency = 2;
    this.ludoGameplayProvider.matchNormalGames(
      this.matchingSchedulerCount % broadcastTableListFrequency === 0,
    );

    this.matchingSchedulerCount =
      (this.matchingSchedulerCount + 1) % broadcastTableListFrequency;
  }

  async spMatchGames() {
    this.spGameplayProvider.matchGames();
  }

  async reMatchGames() {
    this.reGameplayProvider.matchGames();
  }

  @Cron(config.socketGateway.broadcastOnlineUserCountCronExpr)
  async broadcastOnlineUserCount() {
    try {
      this.socketGatewayProvider.broadcastOnlineUserCount();
      this.ludoGameplayProvider.broadcastOnlineUserCount();
      this.spGameplayProvider.broadcastOnlineUserCount();
      this.reGameplayProvider.broadcastOnlineUserCount();
      this.cbrGameplayProvider.broadcastOnlineUserCount();
    } catch (error) {
      console.log(error);
    }
  }

  @Cron(config.scheduler.leaderboard.day)
  async updateDayLeaderboard() {
    try {
      this.gameRecordProvider.updateDayLeaderboard();
    } catch (error) {
      console.log(error);
    }
  }

  @Cron(config.scheduler.leaderboard.week)
  async updateWeekLeaderboard() {
    try {
      this.gameRecordProvider.updateWeekLeaderboard();
    } catch (error) {
      console.log(error);
    }
  }

  @Cron(config.scheduler.leaderboard.month)
  async updateMonthLeaderboard() {
    try {
      this.gameRecordProvider.updateMonthLeaderboard();
    } catch (error) {
      console.log(error);
    }
  }

  // @Cron(config.scheduler.oldUserPN.time)
  // async sendOldUserPN() {
  //   try {
  //     const { hours, messages, deepLink } = config.scheduler.oldUserPN;
  //     const oldUsers = await this.userModel.find(
  //       {
  //         updatedAt: {
  //           $lt: dayjs().subtract(hours, 'hour').toDate(),
  //         },
  //       },
  //       { _id: 1 },
  //     );
  //     for (let index = 0; index < oldUsers.length; index += 2000) {
  //       const userIds = oldUsers
  //         .slice(index, Math.min(index + 2000, oldUsers.length))
  //         .map((user) => user._id.toString());
  //       const message = messages[Math.floor(Math.random() * messages.length)];
  //       await this.notificationProvider.sendMassPushNotifications(
  //         userIds,
  //         message.title,
  //         message.content,
  //         deepLink,
  //       );
  //     }
  //   } catch (error) {
  //     console.log(error);
  //   }
  // }
}
