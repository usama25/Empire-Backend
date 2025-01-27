import * as dayjs from 'dayjs';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';

import { config } from '@lib/fabzen-common/configuration';
import { Games } from '@lib/fabzen-common/types';
import { LudoTableInfo } from '@lib/fabzen-common/remote-config/types';
import { LudoRemoteConfigService } from '@lib/fabzen-common/remote-config/interfaces';

import { LudoGameplayService } from '../../ludo-gameplay.service';
import { RedisTransientDBService } from '../transient-db/redis-backend';
import { LudoGameplayGateway } from '../../ludo-gameplay.gateway';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import {
  UserID,
  GameTypes,
  WaitingUser,
  MatchingTable,
  UserNameWithAvatar,
} from '../../ludo-gameplay.types';
import { RedisService } from '../redis/service';

const { userWaitingTableKey } = config.ludoGameplay.redis;

@Injectable()
export class WaitingTableQueueService {
  private readonly logger = new Logger(WaitingTableQueueService.name);
  constructor(
    @Inject(forwardRef(() => LudoGameplayService))
    private readonly ludoGameplayService: LudoGameplayService,
    private readonly ludoGameplayGateway: LudoGameplayGateway,
    private readonly redisService: RedisService,
    private readonly transientDBService: RedisTransientDBService,
    private readonly ludoRemoteConfig: LudoRemoteConfigService,
    private userRepository: UserRepository,
  ) {}

  async addToQueue(userId: string, tableInfo: LudoTableInfo) {
    try {
      const {
        tableTypeId,
        tableType: type,
        maxPlayer: roomSize,
        matchingTime,
      } = tableInfo;
      const userDetails = await this.userRepository.getUserGameDetails(
        userId,
        Games.ludo,
      );
      const queueName = this.getQueueName(tableTypeId);

      const matchingTimeout = dayjs().add(matchingTime, 'seconds');

      const waitingUser: WaitingUser = {
        expiry: matchingTimeout.valueOf(),
        ip: userDetails.ip,
        userDetails,
        tableTypeId,
      };

      await this.redisService.setValue(queueName, userId, waitingUser);

      await this.transientDBService.setUserWaitingQueueName(userId, queueName);

      const waitingUsers = await this.getWaitingUsers(
        queueName,
        roomSize > 2 && userId,
      );

      while (waitingUsers.length > roomSize) {
        waitingUsers.splice(0, roomSize);
      }

      const tableTimeout =
        type === GameTypes.furious4
          ? dayjs(waitingUsers[0].expiry)
          : matchingTimeout;

      if (type === GameTypes.furious4) {
        const userNamesWithAvatar =
          await this.getUserNamesWithAvatarOfQueue(waitingUsers);
        const userIds = userNamesWithAvatar.map(({ userId }) => userId);
        this.ludoGameplayGateway.notifyUserJoined(userIds, userNamesWithAvatar);
      }
      this.ludoGameplayGateway.sendTableTimeout(
        userId,
        tableTimeout.toISOString(),
      );
    } catch (error) {
      console.log(error);
    }
  }

  async removeFromQueue(userId: UserID, tableTypeId: string) {
    const queueName = this.getQueueName(tableTypeId);
    const userWaitingInfo = await this.redisService.getValue<WaitingUser>(
      queueName,
      userId,
      true,
    );
    if (!userWaitingInfo) {
      return;
    }
    userWaitingInfo.expiry = 0;
    await this.redisService.setValue(queueName, userId, userWaitingInfo);
  }

  async isUserOnQueue(userId: UserID, tableTypeId: string): Promise<boolean> {
    const queueName = this.getQueueName(tableTypeId);
    const userWaitingInfo = await this.redisService.getValue<WaitingUser>(
      queueName,
      userId,
      true,
    );
    // false if no key or expiry is 0
    return !!userWaitingInfo && userWaitingInfo.expiry > 0;
  }

  private async match(
    tableInfo: LudoTableInfo,
  ): Promise<MatchingTable | undefined> {
    const { tableTypeId, tableType: type, amount: joinFee } = tableInfo;
    const queueName = this.getQueueName(tableTypeId);
    try {
      const waitingUsers = await this.getWaitingUsers(queueName);
      const { isIPRestrictionEnabled } =
        this.ludoRemoteConfig.getMatchMakingConfig();
      const splitUsers =
        isIPRestrictionEnabled && type === GameTypes.furious4
          ? this.splitWaitingUsers(waitingUsers)
          : [waitingUsers];
      let latestTimeout = dayjs();
      for (const group of splitUsers) {
        const timeout = await this._match(group, tableInfo);
        if (timeout?.isAfter(latestTimeout)) {
          latestTimeout = timeout;
        }
      }
      return Number(joinFee) > 300
        ? {
            type,
            joinFee,
            timeout: latestTimeout.toISOString(),
          }
        : undefined;
    } catch (error) {
      this.logger.error(`Matching Scheduler Error: ${error.message}`);
      throw error;
    }
  }

  private async _match(
    waitingUsers: WaitingUser[],
    tableInfo: LudoTableInfo,
  ): Promise<dayjs.Dayjs | undefined> {
    if (waitingUsers.length === 0) {
      return;
    }
    const {
      tableTypeId,
      tableType: type,
      amount: joinFee,
      maxPlayer: roomSize,
    } = tableInfo;
    const queueName = this.getQueueName(tableTypeId);
    const leftUserIds = waitingUsers
      .filter(({ expiry }) => expiry === 0)
      .map(({ userDetails: { userId } }) => userId);
    const remainingUsers = waitingUsers.filter(({ expiry }) => expiry !== 0);
    const remainingUsers_ = [...remainingUsers];
    const matchedUserIds: string[] = [];
    const expiredUserIds: string[] = [];

    let timeout: dayjs.Dayjs | undefined;

    while (remainingUsers_.length > 0) {
      const potentiallyMatchedUsers = remainingUsers_.splice(0, roomSize);
      const expiry = dayjs(potentiallyMatchedUsers[0].expiry);
      if (potentiallyMatchedUsers.length === 1) {
        if (dayjs().isAfter(expiry)) {
          expiredUserIds.push(potentiallyMatchedUsers[0].userDetails.userId);
        } else {
          timeout = expiry;
        }
      } else if (
        potentiallyMatchedUsers.length === roomSize ||
        dayjs().isAfter(expiry)
      ) {
        const potentiallyMatchedUserIds = potentiallyMatchedUsers.map(
          ({ userDetails: { userId } }) => userId,
        );
        matchedUserIds.push(...potentiallyMatchedUserIds);
        this.ludoGameplayService.startGame(potentiallyMatchedUsers);
      } else {
        timeout = expiry;
      }
    }

    const isBigTable =
      Number(joinFee) >=
      Number(
        this.ludoRemoteConfig.getMatchMakingConfig()
          .minimumJoinAmountForNotifications,
      );

    if (isBigTable && expiredUserIds.length > 0) {
      await Promise.all(
        expiredUserIds.map((userId) =>
          this.transientDBService.setBigTableUser(userId),
        ),
      );
    }

    if (leftUserIds.length > 0 && type === GameTypes.furious4) {
      const userNamesWithAvatar =
        await this.getUserNamesWithAvatarOfQueue(remainingUsers);
      const userIds = userNamesWithAvatar.map(({ userId }) => userId);
      this.ludoGameplayGateway.notifyUserJoined(userIds, userNamesWithAvatar);
    }

    await Promise.all([
      this.redisService.deleteMultipleHashkeys(queueName, [
        ...matchedUserIds,
        ...leftUserIds,
        ...expiredUserIds,
      ]),
      this.redisService.deleteMultipleHashkeys(userWaitingTableKey, [
        ...matchedUserIds,
        ...leftUserIds,
        ...expiredUserIds,
      ]),
      ...expiredUserIds.map((userId) =>
        this.transientDBService.setUserNotMatchedKey(userId, true),
      ),
    ]);
    if (leftUserIds.length > 0) {
      this.ludoGameplayGateway.leftWaitingTable(leftUserIds);
    }

    return timeout;
  }

  public async getWaitingUsers(
    queueName: string,
    userId?: string | undefined | false,
  ): Promise<WaitingUser[]> {
    const tableTypeId = this.getTableTypeIdFromQueueName(queueName);
    const { maxPlayer: roomSize } =
      this.ludoRemoteConfig.getTableInfoByTypeId(tableTypeId);
    const allWaitingUsers =
      await this.redisService.getAllHashkeyValues<WaitingUser>(queueName, true);
    const sortedWaitingUsers = Object.values(allWaitingUsers).sort(
      (a, b) => a.expiry - b.expiry,
    );
    const { isIPRestrictionEnabled } =
      this.ludoRemoteConfig.getMatchMakingConfig();

    if (isIPRestrictionEnabled && userId && roomSize > 2) {
      // Need to split based on ip address
      const splitUsers = this.splitWaitingUsers(sortedWaitingUsers);
      let targetGroup: WaitingUser[] = [];
      for (const group of splitUsers) {
        if (group.some((user) => user.userDetails.userId === userId)) {
          targetGroup = group;
        }
      }
      return targetGroup;
    }
    return sortedWaitingUsers;
  }

  private splitWaitingUsers(waitingUsers: WaitingUser[]): WaitingUser[][] {
    const result: WaitingUser[][] = [];
    for (const waitingUser of waitingUsers) {
      let foundGroup = false;
      for (const group of result) {
        let canBePut = true;
        for (const referenceUser of group) {
          if (this.checkIfSameOrigin(referenceUser, waitingUser)) {
            canBePut = false;
            break;
          }
        }
        if (canBePut) {
          group.push(waitingUser);
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) {
        result.push([waitingUser]);
      }
    }
    return result;
  }

  private checkIfSameOrigin(a: WaitingUser, b: WaitingUser) {
    return a.ip === b.ip;
  }

  async getUserNamesWithAvatarOfQueue(
    waitingUsers: WaitingUser[],
  ): Promise<UserNameWithAvatar[]> {
    const userNamesWithAvatar = waitingUsers.map(
      ({ userDetails: { userId, avatar, name, username } }) => ({
        userId,
        name: name ?? username,
        avatarIndex: avatar || 1,
      }),
    );
    return userNamesWithAvatar;
  }

  private getQueueName(tableTypeId: string): string {
    return `{${tableTypeId}}`;
  }

  public getTableTypeIdFromQueueName(queueName: string): string {
    return queueName.slice(1, -1);
  }

  async matchAllTypes(shouldBroadcastTableList: boolean) {
    const matchingTables: MatchingTable[] = [];
    const allTableInfos = this.ludoRemoteConfig.getAllTableInfos();
    for (const tableInfo of allTableInfos) {
      const matchingTable = await this.match(tableInfo);
      if (matchingTable) {
        matchingTables.push(matchingTable);
      }
    }
    if (shouldBroadcastTableList) {
      this.ludoGameplayGateway.sendMatchingTableList(matchingTables);
    }
  }
}
