import {
  PlayerGameInfo,
  SubWallet,
  Table,
  TableID,
  TableType,
  TransporterCmds,
  UserID,
} from '@lib/fabzen-common/types';
import { MicroserviceProvider } from '@lib/fabzen-common/utils/microservice-provider';

export class SocketGatewayProvider extends MicroserviceProvider {
  spEmitJoinTableEvent(userIds: UserID[], tableId: TableID) {
    this._sendEvent(TransporterCmds.SP_EMIT_JOIN_TABLE_EVENT, {
      userIds,
      tableId,
    });
  }

  spEmitStartRoundEvent(tableId: TableID) {
    this._sendEvent(TransporterCmds.SP_EMIT_START_ROUND_EVENT, {
      tableId,
    });
  }

  spEmitLeftWaitingTableEvent(userId: UserID, status: boolean) {
    this._sendEvent(TransporterCmds.SP_EMIT_LEFT_WAITING_EVENT, {
      userId,
      status,
    });
  }

  spEmitJoinExistingTableEvent(table: Table, newPlayer: PlayerGameInfo) {
    this._sendEvent(TransporterCmds.SP_EMIT_JOIN_EXISTING_TABLE_EVENT, {
      table,
      newPlayer,
    });
  }

  spEmitDestroyInactiveTableEvent(tableId: TableID) {
    this._sendEvent(TransporterCmds.SP_EMIT_DESTROY_INACTIVE_TABLE_EVENT, {
      tableId,
    });
  }

  spEmitClearQueueEvent(queueName: string) {
    this._sendEvent(TransporterCmds.SP_EMIT_CLEAR_QUEUE_EVENT, {
      queueName,
    });
  }

  spEmitEndGameEvent(tableId: TableID) {
    this._sendEvent(TransporterCmds.SP_EMIT_END_GAME_EVENT, {
      tableId,
    });
  }

  spEmitRoundEndEvent(tableId: TableID) {
    this._sendEvent(TransporterCmds.SP_EMIT_ROUND_END_EVENT, {
      tableId,
    });
  }

  spEmitNextEvent(tableId: TableID, isSideshow?: boolean) {
    this._sendEvent(TransporterCmds.SP_EMIT_NEXT_EVENT, {
      tableId,
      isSideshow,
    });
  }

  spEmitInitialBetEvent(tableId: TableID) {
    this._sendEvent(TransporterCmds.SP_EMIT_INITIAL_BET_EVENT, {
      tableId,
    });
  }

  spEmitDealCardsEvent(tableId: TableID) {
    this._sendEvent(TransporterCmds.SP_EMIT_DEAL_CARDS_EVENT, {
      tableId,
    });
  }

  spEmitLeaveTableEvent(tableId: TableID, userId: UserID, isManual?: boolean) {
    this._sendEvent(TransporterCmds.SP_EMIT_LEAVE_TABLE_EVENT, {
      tableId,
      userId,
      isManual,
    });
  }

  spEmitGameEndedEvent(tableId: TableID) {
    this._sendEvent(TransporterCmds.SP_EMIT_GAME_ENDED_EVENT, {
      tableId,
    });
  }

  spEmitEndTableEvent(tableId: TableID) {
    this._sendEvent(TransporterCmds.SP_EMIT_END_TABLE_EVENT, {
      tableId,
    });
  }

  spEmitRebuyEvent(
    table: Table,
    userId: UserID,
    currentAmount: SubWallet,
    walletBalance: string,
  ) {
    this._sendEvent(TransporterCmds.SP_EMIT_REBUY_EVENT, {
      table,
      userId,
      currentAmount,
      walletBalance,
    });
  }

  spEmitPackEvent(tableId: string, userId?: UserID) {
    this._sendEvent(TransporterCmds.SP_EMIT_PACK_EVENT, {
      tableId,
      userId,
    });
  }

  spEmitOnlineUserCountEvent() {
    this._sendEvent(TransporterCmds.SP_EMIT_ONLINE_USER_COUNT_EVENT, {});
  }

  spEmitHandleJoinUser(tableType: TableType, number: number) {
    this._sendEvent(TransporterCmds.SP_EMIT_ONLINE_USER_COUNT_EVENT, {
      tableType,
      number,
    });
  }

  spEmitHandleLeaveUser(tableType: TableType, number: number) {
    this._sendEvent(TransporterCmds.SP_EMIT_HANDLE_LEAVE_USER_EVENT, {
      tableType,
      number,
    });
  }

  broadcastOnlineUserCount() {
    this._sendEvent(TransporterCmds.BROADCAST_ONLINE_USER_COUNT, {});
  }

  sendSocketNotificationForLudoTournament(tournamentId: string) {
    this._sendEvent(TransporterCmds.SOCKET_NOTIFICATION_LUDO_TOURNAMENT, {
      tournamentId,
    });
  }

  async sendMatchMakingSocketNotification(userIds: string[], deepLink: string) {
    await this._sendRequest(TransporterCmds.SOCKET_NOTIFICATION_MATCH_MAKING, {
      userIds,
      deepLink,
    });
  }
}
