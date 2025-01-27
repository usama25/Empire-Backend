import { Server, Socket } from 'socket.io';
import * as dayjs from 'dayjs';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';

import { verifyJwtTokenInSocketIo } from '@lib/fabzen-common/utils/jwt.util';
import {
  WsClient,
  WsData,
  WsSubscribeMessage,
} from '@lib/fabzen-common/decorators';
import { AuthenticatedSocket } from '@lib/fabzen-common/types/socket.types';

import { AviatorGameplayUseCases, RoundStatus } from '../../domain/use-cases';
import {
  FLY_EMIT_INTERVAL,
  ROUND_START_TIMEOUT,
} from '../repositories/constants';
import { AviatorRoundRepository } from '../../domain/interfaces';
import Big from 'big.js';
import { delay } from '@lib/fabzen-common/utils/time.utils';
import { UserProvider } from 'apps/user/src/user.provider';
import { TransporterProviders } from '@lib/fabzen-common/types';
import { ClientProxy } from '@nestjs/microservices';

@WebSocketGateway({
  namespace: '/socket',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class AviatorGameplaySocketGateway implements OnGatewayConnection {
  @WebSocketServer() wss: Server;
  private multiplier: number;
  private readonly userProvider: UserProvider;

  constructor(
    private readonly gameplayUseCases: AviatorGameplayUseCases,
    private readonly aviatorRoundRepository: AviatorRoundRepository,
    @Inject(TransporterProviders.USER_SERVICE)
    private userClient: ClientProxy,
  ) {
    this.userProvider = new UserProvider(this.userClient);
  }

  async handleConnection(client: Socket) {
    this.#authenticateSocket(client);
    this.#forceDisconnectSameUsers(client as AuthenticatedSocket);
    this.#sendServerTime(client);
    this.#sendReconnectionData(client);
  }

  #authenticateSocket(client: Socket) {
    try {
      verifyJwtTokenInSocketIo(client);
    } catch {
      client.disconnect(true);
      return;
    }
  }

  #forceDisconnectSameUsers(client: AuthenticatedSocket) {
    const { user, id: socketId } = client as AuthenticatedSocket;
    const userId = user.userId;
    client.join(userId);
    this.wss.to(userId).except(socketId).emit('forceLogout', {
      cause: 'Logged in from other device',
    });
    this.wss.in(userId).except(socketId).disconnectSockets(true);
  }

  #sendServerTime(client: Socket) {
    client.emit('serverTime', { time: dayjs().toISOString() });
  }

  async #sendReconnectionData(client: Socket) {
    const { roundStartTime, roundStatus } =
      await this.aviatorRoundRepository.getCurrentRoundInfo();
    const { user } = client as AuthenticatedSocket;
    if (roundStatus === RoundStatus.started) {
      const players = await this.gameplayUseCases.getCurrentRoundPlayers();
      const multiplierValue = await this.gameplayUseCases.getMultiplier(
        roundStatus,
        roundStartTime,
      );
      const playerState = players
        .map((player) => player.userId)
        .includes(user.userId)
        ? 'playing'
        : 'waiting';
      const newPlayers = players.map((player) => {
        const newPlayer: any = { ...player };
        newPlayer.multiplierValue = Big(player.cashoutAmount)
          .div(player.betAmount)
          .toFixed(2);
        return newPlayer;
      });
      client.emit('reconnectGame', {
        timeout: '0',
        multiplierValue,
        players: newPlayers,
        playerState,
      });
    } else if (roundStatus === RoundStatus.waiting) {
      const players = await this.gameplayUseCases.getCurrentRoundPlayers();
      const playerState = players
        .map((player) => player.userId)
        .includes(user.userId)
        ? 'playing'
        : 'waiting';
      client.emit('reconnectGame', {
        timeout: roundStartTime,
        multiplierValue: 1,
        players,
        playerState,
      });
    } else {
      client.emit('reconnectGame', {
        isReconnected: false,
      });
    }
  }

  @WsSubscribeMessage('bet')
  async onUserBet(
    @WsClient() client: AuthenticatedSocket,
    @WsData() { amount }: { amount: string },
  ) {
    const { user } = client;
    await this.gameplayUseCases.bet(user.userId, amount);
    const userEntity = await this.userProvider.getUser(user.userId);
    this.wss.emit('playerBet', {
      userId: user.userId,
      betAmount: amount,
      username: userEntity.name || userEntity.username,
      avatar: userEntity.avatar,
    });
  }

  @OnEvent('roundStarted')
  async onRoundStarted(roundNo: number, roundStartTime: Date) {
    this.wss.emit('roundStarted', {
      roundNo,
      roundStartTime,
    });
    setTimeout(
      async () => {
        const roundInfo =
          await this.aviatorRoundRepository.getCurrentRoundInfo();
        this.aviatorRoundRepository.setCurrentRoundInfo({
          ...roundInfo,
          roundStatus: RoundStatus.started,
        });
        const crashValue = await this.aviatorRoundRepository.getCrashValue();
        if (!crashValue) {
          throw new BadRequestException('Crash value not set');
        }
        while (true) {
          const value = this.gameplayUseCases.getMultiplier(
            roundInfo.roundStatus,
            roundInfo.roundStartTime,
          );
          if (value >= crashValue) {
            this.onCrash();
            break;
          }
          if (this.multiplier !== value) {
            this.wss.emit('fly', { value });
            this.multiplier = value;
          }
          await delay(1000 * FLY_EMIT_INTERVAL);
        }
      },
      1000 * ROUND_START_TIMEOUT + 2,
    );
  }

  @WsSubscribeMessage('cashoutReq')
  async onCashout(@WsClient() client: AuthenticatedSocket) {
    const { user } = client;
    const { roundNo, roundStatus, roundStartTime } =
      await this.aviatorRoundRepository.getCurrentRoundInfo();
    const value = this.gameplayUseCases.getMultiplier(
      roundStatus,
      roundStartTime,
    );
    if (roundStatus !== RoundStatus.started) {
      throw new BadRequestException('Round ended');
    }
    const userBetAmount = await this.aviatorRoundRepository.getBetInfo(
      roundNo,
      user.userId,
    );
    if (!userBetAmount) {
      throw new BadRequestException('User has not placed bet');
    }
    const winAmount = Big(userBetAmount).times(value).toFixed(2).toString();
    await this.gameplayUseCases.addWinningAmount(user.userId, winAmount);
    await this.gameplayUseCases.updateUserHistory(
      user.userId,
      roundNo,
      Number(winAmount),
      Number(userBetAmount),
    );
    const userEntity = await this.userProvider.getUser(user.userId);
    this.wss.emit('cashoutRes', {
      userId: user.userId,
      multiplierValue: value,
      amount: winAmount,
      username: userEntity.name || userEntity.username,
    });
  }

  async onCrash() {
    const value = (await this.aviatorRoundRepository.getCrashValue()) || 0;
    this.wss.emit('crash', { value });

    const roundInfo = await this.aviatorRoundRepository.getCurrentRoundInfo();
    const serverSeed =
      (await this.aviatorRoundRepository.getServerSeed()) || '';
    await this.gameplayUseCases.updateRoundHistory(
      roundInfo.roundNo,
      value,
      serverSeed,
    );

    await this.aviatorRoundRepository.setCurrentRoundInfo({
      ...roundInfo,
      roundStatus: RoundStatus.ended,
    });
  }

  async broadcastOnlineUserCount() {
    const count = await this.getOnlineUserCount();
    this.wss.emit('onlineUserCountRes', { count });
  }

  async getOnlineUserCount() {
    const sockets = await this.wss.fetchSockets();
    const count = sockets ? sockets.length : 0;
    return count;
  }
}
