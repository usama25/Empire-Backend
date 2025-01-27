import * as dayjs from 'dayjs';
import { Server } from 'socket.io';
import { Inject, Injectable } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { RedisTransientDBService as SpRedisTransientDBService } from 'apps/sp-gameplay/src/services/transient-db/redis-backend';
import { RedisTransientDBService as CbrRedisTransientDBService } from 'apps/cbr-gameplay/src/redis/backend';
import { RedisTransientDBService as LudoRedisTransientDBService } from 'apps/ludo-gameplay/src/services/transient-db/redis-backend';
import { Games, TransporterProviders } from '@lib/fabzen-common/types';
import { verifyJwtTokenInSocketIo } from '../guards';
import { MongooseLudoTournamentRepository } from '@lib/fabzen-common/mongoose/repositories/mongoose-ludo-tournament.repository';
import { LudoMegaTournamentProvider } from 'apps/ludo-mega-tournament/src/ludo-mega-tournament.provider';
import { ClientProxy } from '@nestjs/microservices';
import { SLGameProvider } from 'apps/sl-gameplay/src/sl-gameplay.provider';
import { ReGameplayProvider } from 'apps/re-gameplay/src/re-gameplay.provider';
import { AviatorGameplayProvider } from 'apps/aviator-gameplay/src/aviator-gameplay.provider';

@WebSocketGateway({
  namespace: '/socket',
})
@Injectable()
export class MainGateway implements OnGatewayConnection {
  private readonly ludoMegaTournamentProvider: LudoMegaTournamentProvider;
  private readonly slGameProvider: SLGameProvider;
  private readonly reGameplayProvider: ReGameplayProvider;
  private readonly aviatorGameplayProvider: AviatorGameplayProvider;

  @WebSocketServer() wss: Server;

  constructor(
    private readonly spTransientDBService: SpRedisTransientDBService,
    private readonly cbrTransientDBService: CbrRedisTransientDBService,
    private readonly ludoTransientDBService: LudoRedisTransientDBService,
    private readonly ludoTournamentRepository: MongooseLudoTournamentRepository,
    @Inject(TransporterProviders.LUDO_MEGA_TOURNAMENT_SERVICE)
    private megaTournamentServiceClient: ClientProxy,
    @Inject(TransporterProviders.SL_GAMEPLAY_SERVICE)
    private slGameplayServiceClient: ClientProxy,
    @Inject(TransporterProviders.RE_GAMEPLAY_SERVICE)
    private reGameplayServiceClient: ClientProxy,
    @Inject(TransporterProviders.AVIATOR_GAMEPLAY_SERVICE)
    private aviatorGameplayServiceClient: ClientProxy,
  ) {
    this.ludoMegaTournamentProvider = new LudoMegaTournamentProvider(
      this.megaTournamentServiceClient,
    );
    this.slGameProvider = new SLGameProvider(this.slGameplayServiceClient);
    this.reGameplayProvider = new ReGameplayProvider(
      this.reGameplayServiceClient,
    );
    this.aviatorGameplayProvider = new AviatorGameplayProvider(
      this.aviatorGameplayServiceClient,
    );
  }

  async handleConnection(client: any) {
    try {
      verifyJwtTokenInSocketIo(client);
    } catch {
      client.disconnect(true);
      return;
    }

    client.emit('serverTime', { time: dayjs().toISOString() });

    const { user, id: socketId } = client;
    const userId = user.userId;

    client.join(userId);
    this.wss.to(userId).except(socketId).emit('forceLogout', {
      cause: 'Logged in from other device',
    });
    this.wss.in(userId).except(socketId).disconnectSockets(true);

    const game = await this.getConnectedGame(userId);
    if (game) {
      client.emit('reconnectGame', { isReconnected: true, game });
    } else {
      client.emit('reconnectGame', { isReconnected: false });
    }
  }

  async broadcastOnlineUserCount() {
    const count = await this.getOnlineUserCount();
    this.wss.emit('onlineUserCountRes', { count });
  }

  async sendSocketNotificationForLudoTournament(tournamentId: string) {
    const tournamentInfo =
      await this.ludoTournamentRepository.getTournamentInfoForSocketNotification(
        tournamentId,
      );
    const { userIds, ...payloadToEmit } = tournamentInfo;
    this.wss.in(userIds).emit('tournamentWillStart', payloadToEmit);
  }

  async sendMatchMakingSocketNotification(userIds: string[], deeplink: string) {
    this.wss.in(userIds).emit('matchMakingNotification', { deeplink });
  }

  async getOnlineUserCount(): Promise<number> {
    const sockets = await this.wss.fetchSockets();
    const count = sockets ? sockets.length : 0;
    return this.#processUserCount(count);
  }

  #processUserCount(originalCount: number): number {
    const thousandsPlace = Math.floor(originalCount / 1000);
    const hundredsPlace = Math.floor((originalCount % 1000) / 100);
    const tensPlace = Math.floor((originalCount % 100) / 10);
    const onesPlace = originalCount % 10;

    return (
      thousandsPlace * 60_000 +
      hundredsPlace * 3000 +
      tensPlace * 200 +
      onesPlace
    );
  }

  async getConnectedGame(userId: string): Promise<Games | undefined> {
    if (await this.isUserConnectedToSp(userId)) {
      return Games.skillpatti;
    } else if (await this.isUserConnectedToCbr(userId)) {
      return Games.callbreak;
    } else if (await this.isUserConnectedToLudo(userId)) {
      return Games.ludo;
    } else if (await this.isUserConnectedToLudoMegaTournament(userId)) {
      return Games.ludoMegaTournament;
    } else if (await this.isUserConnectedToSLGame(userId)) {
      return Games.snakeAndLadders;
    } else if (await this.isUserConnectedToRe(userId)) {
      return Games.rummyempire;
    } else if (await this.isUserConnectedToAviator(userId)) {
      return Games.aviator;
    }
  }

  async isUserConnectedToSp(userId: string): Promise<boolean> {
    const activeTableId =
      await this.spTransientDBService.getUserActiveTableId(userId);
    const userWaitingInfo =
      await this.spTransientDBService.getUserWaitingTable(userId);
    return !!activeTableId || !!userWaitingInfo;
  }

  async isUserConnectedToCbr(userId: string): Promise<boolean> {
    const activeTableId =
      await this.cbrTransientDBService.getUserActiveTableId(userId);
    return !!activeTableId;
  }

  async isUserConnectedToLudo(userId: string): Promise<boolean> {
    const activeTableId =
      await this.ludoTransientDBService.getUserActiveTableId(userId);
    const waitingQueueName =
      await this.ludoTransientDBService.getUserWaitingQueueName(userId);
    return !!activeTableId || !!waitingQueueName;
  }

  async isUserConnectedToLudoMegaTournament(userId: string): Promise<boolean> {
    return await this.ludoMegaTournamentProvider.checkIfReconnected(userId);
  }

  async isUserConnectedToRe(userId: string): Promise<boolean> {
    return await this.reGameplayProvider.checkIfReconnected(userId);
  }

  async isUserConnectedToSLGame(userId: string): Promise<boolean> {
    return await this.slGameProvider.checkIfReconnected(userId);
  }

  async isUserConnectedToAviator(userId: string): Promise<boolean> {
    return await this.aviatorGameplayProvider.checkIfReconnected(userId);
  }
}
