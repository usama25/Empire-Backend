import { Injectable } from '@nestjs/common';
import { Table } from '../../ludo-gameplay.types';

@Injectable()
export abstract class TransientDBService {
  abstract getUserActiveTableId(userId: string): Promise<string | undefined>;
  abstract setUserActiveTableId(userId: string, tableId: string): void;

  abstract getActiveTable(tableId: string): Promise<Table | undefined>;
  abstract setActiveTable(table: Table): void;
  abstract deleteActiveTable(tableId: string): void;

  abstract getUserWaitingQueueName(userId: string): Promise<string | undefined>;
  abstract setUserWaitingQueueName(userId: string, queueName: string): void;
  abstract deleteUserWaitingTable(userId: string): void;
}
