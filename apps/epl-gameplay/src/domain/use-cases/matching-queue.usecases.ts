import * as dayjs from 'dayjs';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Games } from '@lib/fabzen-common/types';
import { LockerService } from '@lib/fabzen-common/locker/locker.service';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { EPLMatchingQueueService } from '../interfaces/queue.service';
import { EPLGameplayUseCases } from './gameplay.usecases';
import { WaitingInfo } from './types';
import { WAITING_TIME_EXTENSION_IN_SECONDS } from './constants';
import { PLAYERS_PER_GAME } from '../entities/constants';
import { EPLRemoteConfigService } from '@lib/fabzen-common/remote-config/interfaces';

@Injectable()
export class EPLGameMatchingQueueUseCases {
  private readonly logger = new Logger(EPLGameMatchingQueueUseCases.name);
  constructor(
    private readonly configService: EPLRemoteConfigService,
    private readonly queueService: EPLMatchingQueueService,
    private readonly userRepository: UserRepository,
    @Inject(forwardRef(() => EPLGameplayUseCases))
    private readonly gameplayUsecase: EPLGameplayUseCases,
    private eventEmitter: EventEmitter2,
    private readonly lockerService: LockerService,
  ) {}

  async putInQueue(
    userId: string,
    tableTypeId: string,
  ): Promise<{ waitingUsers: WaitingInfo[]; timeout: string }> {
    this.logger.log(`User ${userId} putting in the queue ${tableTypeId}`);
    const tableInfo =
      this.configService.getEPLGameTableInfoByTableTypeId(tableTypeId);
    const { matchingTime: waitingTimeInSeconds, maxPlayer } = tableInfo;

    const userDetails = await this.userRepository.getUserGameDetails(
      userId,
      Games.epl,
    );

    const expiry = dayjs().add(waitingTimeInSeconds, 'seconds').valueOf();

    const newUser: WaitingInfo = {
      expiry,
      userDetails,
    };
    await this.queueService.putInQueue(tableTypeId, newUser);
    await this.queueService.setUserWaitingKey(userId, tableTypeId);
    const waitingUsers = await this.queueService.getUsersFromQueue(tableTypeId);
    // Get only last <maxPlayer> number of users
    while (waitingUsers.length > maxPlayer) {
      waitingUsers.splice(0, maxPlayer);
    }
    const timeout = this.getMatchingTimeout_(waitingUsers).toISOString();
    return { waitingUsers, timeout };
  }

  public getMatchingTimeout_(waitingUsers: WaitingInfo[]): dayjs.Dayjs {
    return dayjs(waitingUsers[0].expiry);
  }

  public getMatchingTimeout(
    waitingUsers: WaitingInfo[],
    waitingTimeInSeconds: number,
    maxPlayer: number,
  ): dayjs.Dayjs {
    if (waitingUsers.length === 1) {
      const expiry = dayjs(waitingUsers[0].expiry);
      return expiry;
    } else if (waitingUsers.length > 1 && waitingUsers.length < maxPlayer) {
      const expiry = dayjs(waitingUsers[1].expiry)
        .subtract(waitingTimeInSeconds, 'seconds')
        .add(WAITING_TIME_EXTENSION_IN_SECONDS, 'seconds');
      return expiry;
    } else {
      const expiry = dayjs(waitingUsers[maxPlayer - 1].expiry)
        .subtract(waitingTimeInSeconds, 'seconds')
        .add(1, 'seconds');
      return expiry;
    }
  }

  public matchUsers() {
    const tableTypeIds = this.getTableTypeIds();
    for (const tableTypeId of tableTypeIds) {
      this.match(tableTypeId);
    }
  }

  private async match(tableTypeId: string): Promise<void> {
    await this.lockerService.acquireLock(tableTypeId);
    try {
      const maxPlayer = PLAYERS_PER_GAME;
      const { matchingTime: waitingTimeInSeconds } =
        this.configService.getEPLGameTableInfoByTableTypeId(tableTypeId);

      const waitingUsers =
        await this.queueService.getUsersFromQueue(tableTypeId);
      if (waitingUsers.length === 0) {
        return;
      }

      const timedOutUserIds: string[] = [];
      const matchedUserIds: string[] = [];

      const currentTime = dayjs();

      while (waitingUsers.length > 0) {
        const potentiallyMatchedUsers = waitingUsers.splice(0, maxPlayer);
        const matchingTimeout = this.getMatchingTimeout(
          potentiallyMatchedUsers,
          waitingTimeInSeconds,
          maxPlayer,
        );
        if (currentTime.isAfter(matchingTimeout)) {
          if (potentiallyMatchedUsers.length === 1) {
            timedOutUserIds.push(potentiallyMatchedUsers[0].userDetails.userId);
          } else {
            this.gameplayUsecase.startGame(
              tableTypeId,
              potentiallyMatchedUsers,
            );
            const newlyMatchedUserIds = potentiallyMatchedUsers.map(
              (waitingUser) => waitingUser.userDetails.userId,
            );
            matchedUserIds.push(...newlyMatchedUserIds);
          }
        }
      }

      if (timedOutUserIds.length > 0) {
        this.eventEmitter.emit('socketEvent.matchingTimeout', timedOutUserIds);
      }
      const userIdsToRemove = [...matchedUserIds, ...timedOutUserIds];
      await this.queueService.removeUsersFromQueue(
        tableTypeId,
        userIdsToRemove,
      );
    } finally {
      await this.lockerService.releaseLock(tableTypeId);
    }
  }

  private getTableTypeIds(): string[] {
    const eplTables = this.configService.getEPLGameTables();
    return eplTables.map(({ tableTypeId }) => tableTypeId);
  }
}
