import * as dayjs from 'dayjs';

import { config } from '@lib/fabzen-common/configuration';
import {
  GameTypes,
  Player,
  PlayerId,
  Table,
  TableType,
  UserID,
} from '@lib/fabzen-common/types';

/**
 * Get the Player Id from position
 * @example PL2
 */
export function getPlayerId(playerIndex: number): PlayerId {
  return `${config.spGameplay.playerPrefix}${playerIndex}` as PlayerId;
}

export function getGameConfig(tableType: TableType): any {
  return config.spGameplay.gameTypes.find(
    (value) => value.type === tableType.gameType,
  );
}

export function getPlayerIndex(table: Table, userId: UserID) {
  return table.players.findIndex((player) => player.userId === userId);
}

export function getPlayerIdByUserId(table: Table, userId: UserID): PlayerId {
  const playerIndex = getPlayerIndex(table, userId);
  return table.players[playerIndex].playerId;
}

export function getReadyPlayersNo(table: Table) {
  return table.players.filter((player) => player.active !== undefined).length;
}

export function getNoPlayers(tableType: TableType): number {
  return tableType.gameType === GameTypes.multiplayer ? 6 : 2;
}

export function getMatchingTimeout(tableType: TableType): number {
  return getGameConfig(tableType)?.matchingTimeout;
}

export function getTurnTimeout(): string {
  return dayjs().add(config.spGameplay.turnTimeout, 'second').toISOString();
}

export function getStartTimeout(): string {
  return dayjs().add(config.spGameplay.startTimeout, 'second').toISOString();
}

export function leaveLogs(message: string, info: object) {
  console.log(message, JSON.stringify(info));
}

/**
 * Check if the user has already joined the table
 */
export function checkIfUserAlreadyJoined(
  playerList: Player[],
  userId: UserID,
): boolean {
  return playerList.map(({ userId }) => userId).includes(userId);
}
