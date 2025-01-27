import * as dayjs from 'dayjs';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { Games } from '@lib/fabzen-common/types';
import { LockerService } from '@lib/fabzen-common/locker/locker.service';

import { UserRepository } from 'apps/user/src/domain/interfaces';
import { SLMatchingQueueService } from '../interfaces/queue.service';
import { SLGameplayUseCases } from './gameplay.usecases ';
import { WaitingInfo } from './types';
import { WAITING_TIME_EXTENSION_IN_SECONDS } from './constants';

import { splitArrayByPredicate } from '@lib/fabzen-common/utils/array.util';

@Injectable()
export class SLGameMatchingQueueUseCases {
  private readonly logger = new Logger(SLGameMatchingQueueUseCases.name);
  constructor(
    private readonly configService: RemoteConfigService,
    private readonly queueService: SLMatchingQueueService,
    private readonly userRepository: UserRepository,
    @Inject(forwardRef(() => SLGameplayUseCases))
    private readonly gameplayUsecase: SLGameplayUseCases,
    private eventEmitter: EventEmitter2,
    private readonly lockerService: LockerService,
  ) {}

  async putInQueue(
    userId: string,
    tableTypeId: string,
  ): Promise<{ waitingUsers: WaitingInfo[]; timeout: string }> {
    this.logger.log(`User ${userId} putting in the queue ${tableTypeId}`);
    const tableInfo = this.configService.getSLGameTableInfoByType(tableTypeId);
    const { matchingTime: waitingTimeInSeconds, maxPlayer } = tableInfo;

    const userDetails = await this.userRepository.getUserGameDetails(
      userId,
      Games.snakeAndLadders,
    );

    const expiry = dayjs().add(waitingTimeInSeconds, 'seconds').valueOf();

    const newUser: WaitingInfo = {
      expiry,
      userDetails,
    };
    await this.queueService.putInQueue(tableTypeId, newUser);
    await this.queueService.setUserWaitingKey(userId, tableTypeId);

    const waitingUsers = await this.getWaitingUsers(tableTypeId, userId);
    // Get only last <maxPlayer> number of users
    while (waitingUsers.length > maxPlayer) {
      waitingUsers.splice(0, maxPlayer);
    }

    const timeout = this.getMatchingTimeout_(waitingUsers).toISOString();

    return { waitingUsers, timeout };
  }

  public async getWaitingUsers(
    tableTypeId: string,
    userId?: string,
  ): Promise<WaitingInfo[]> {
    const sortedWaitingUsers =
      await this.queueService.getUsersFromQueue(tableTypeId);
    const { isIPRestrictionEnabled } =
      this.configService.getSLMatchMakingNotificationConfig();

    if (isIPRestrictionEnabled && userId) {
      // Need to split based on ip address
      const splitUsers = this.splitWaitingUsers(sortedWaitingUsers);
      let targetGroup: WaitingInfo[] = [];
      for (const group of splitUsers) {
        if (group.some((user) => user.userDetails.userId === userId)) {
          targetGroup = group;
        }
      }
      return targetGroup;
    }
    return sortedWaitingUsers;
  }

  private splitWaitingUsers(waitingUsers: WaitingInfo[]): WaitingInfo[][] {
    return splitArrayByPredicate(waitingUsers, this.checkIfSameOrigin);
  }

  private checkIfSameOrigin(a: WaitingInfo, b: WaitingInfo) {
    return a.userDetails.ip === b.userDetails.ip;
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
      return dayjs(waitingUsers[0].expiry);
    } else if (waitingUsers.length > 1 && waitingUsers.length < maxPlayer) {
      const matchingTimeout = dayjs(waitingUsers[1].expiry)
        .subtract(waitingTimeInSeconds, 'seconds')
        .add(WAITING_TIME_EXTENSION_IN_SECONDS, 'seconds');
      const firstUserExpiry = dayjs(waitingUsers[0].expiry);
      return firstUserExpiry.isAfter(matchingTimeout)
        ? matchingTimeout
        : firstUserExpiry;
    } else {
      return dayjs(waitingUsers[maxPlayer - 1].expiry)
        .subtract(waitingTimeInSeconds, 'seconds')
        .add(0, 'seconds');
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
      const waitingUsers = await this.getWaitingUsers(tableTypeId);
      const { isIPRestrictionEnabled } =
        this.configService.getSLMatchMakingNotificationConfig();
      const splitUsers = isIPRestrictionEnabled
        ? this.splitWaitingUsers(waitingUsers)
        : [waitingUsers];
      for (const group of splitUsers) {
        await this._match(group, tableTypeId);
      }
    } finally {
      await this.lockerService.releaseLock(tableTypeId);
    }
  }

  private async _match(waitingUsers: WaitingInfo[], tableTypeId: string) {
    const {
      matchingTime: waitingTimeInSeconds,
      maxPlayer,
      amount: joinFee,
    } = this.configService.getSLGameTableInfoByType(tableTypeId);

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
          this.gameplayUsecase.startGame(tableTypeId, potentiallyMatchedUsers);
          const newlyMatchedUserIds = potentiallyMatchedUsers.map(
            (waitingUser) => waitingUser.userDetails.userId,
          );
          matchedUserIds.push(...newlyMatchedUserIds);
        }
      }
    }

    if (timedOutUserIds.length > 0) {
      this.eventEmitter.emit('socketEvent.matchingTimeout', timedOutUserIds);
      const isBigTableNotifiactionEnabled =
        this.checkIfBigTableNotificationEnabled(joinFee);
      if (isBigTableNotifiactionEnabled) {
        await this.queueService.setBigTableUsers(timedOutUserIds);
      }
    }
    const userIdsToRemove = [...matchedUserIds, ...timedOutUserIds];
    await this.queueService.removeUsersFromQueue(tableTypeId, userIdsToRemove);
  }
  private checkIfBigTableNotificationEnabled(joinFee: string): boolean {
    const {
      isPushNotificationsEnabled,
      isSocketNotificationsEnabled,
      minimumJoinAmountForNotifications,
    } = this.configService.getSLMatchMakingNotificationConfig();
    return (
      (isPushNotificationsEnabled || isSocketNotificationsEnabled) &&
      Number(joinFee) >= Number(minimumJoinAmountForNotifications)
    );
  }

  private getTableTypeIds(): string[] {
    const slTables = this.configService.getSLGameTables();
    return slTables.map(({ tableTypeId }) => tableTypeId);
  }
}
