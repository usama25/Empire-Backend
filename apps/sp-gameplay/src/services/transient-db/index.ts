import { Injectable } from '@nestjs/common';

import {
  Currency,
  SocketID,
  TableID,
  UserID,
  TableType,
  Table,
  WaitingInfo,
} from '@lib/fabzen-common/types';

@Injectable()
export abstract class TransientDBService {
  abstract getUserActiveTableId(userId: UserID): Promise<TableID | undefined>;
  abstract setUserActiveTableId(userId: UserID, tableId: TableID): void;

  abstract getUserSocketId(userId: UserID): Promise<SocketID | undefined>;
  abstract setUserSocketId(userId: UserID, socketId: SocketID): void;
  abstract deleteUserSocketId(userId: UserID): void;

  abstract getActiveTable(tableId: TableID): Promise<Table | undefined>;
  abstract setActiveTable(table: Table): void;
  abstract deleteActiveTable(tableId: TableID): void;

  abstract getWaitingTable(
    tableType: TableType,
    currency: Currency,
  ): Promise<WaitingInfo | undefined>;
  abstract setWaitingTable(
    tableType: TableType,
    currency: Currency,
    waitingTable: WaitingInfo,
  ): void;
  abstract deleteWaitingTable(tableType: TableType, currency: Currency): void;

  abstract getUserWaitingTable(
    userId: UserID,
  ): Promise<WaitingInfo | undefined>;
  abstract setUserWaitingTable(userId: UserID, waitingTable: WaitingInfo): void;
  abstract deleteUserWaitingTable(userId: UserID): void;

  abstract getUserLock(userId: UserID): Promise<boolean>;
  abstract setUserLock(userId: UserID, lock: boolean): void;

  abstract getWaitingTableLock(
    tableType: TableType,
    currency: Currency,
  ): Promise<boolean>;
  abstract setWaitingTableLock(
    tableType: TableType,
    currency: Currency,
    lock: boolean,
  ): void;
  abstract getUserCount(tableTypeId: string): Promise<string>;
}
