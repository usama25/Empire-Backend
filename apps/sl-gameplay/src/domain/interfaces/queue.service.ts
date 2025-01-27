import { WaitingInfo } from '../use-cases/types';

export abstract class SLMatchingQueueService {
  abstract putInQueue(tableTypeId: string, newUser: WaitingInfo): Promise<void>;

  abstract setUserWaitingKey(
    userId: string,
    tableTypeId: string,
  ): Promise<void>;

  abstract getUserWaitingTableTypeId(
    userId: string,
  ): Promise<string | undefined>;

  abstract getUsersFromQueue(tableTypeId: string): Promise<WaitingInfo[]>;

  abstract removeUsersFromQueue(
    tableTypeId: string,
    userIds: string[],
  ): Promise<void>;

  abstract getBigTableUsers(): Promise<string[]>;

  abstract setBigTableUsers(userIds: string[]): Promise<void>;

  abstract deleteBigTableUsers(userIds: string[]): Promise<void>;
}
