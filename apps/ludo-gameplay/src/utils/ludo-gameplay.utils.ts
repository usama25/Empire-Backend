import * as dayjs from 'dayjs';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

import { getRandomInteger } from '@lib/fabzen-common/utils/random.utils';
import { config } from '@lib/fabzen-common/configuration';

import {
  CanMovePawn,
  Cell,
  DiceValue,
  GameAction,
  GameTypes,
  PawnId,
  PawnPosition,
  Player,
  PlayerId,
  PlayerInfo,
  Table,
  TableInfo,
  TableState,
  UserID,
  RoundDuration,
  Scores,
  TableInitParameters,
} from '../ludo-gameplay.types';

/**
 * Get the pawn id for a player
 * @example PW1-1
 */
export function getPawnId(playerIndex: number, pawnIndex: number): PawnId {
  return `${config.ludoGameplay.pawnPositionPrefix}${playerIndex}-${pawnIndex}` as PawnId;
}

/**
 * Get the Player Id from position
 * @example PL2
 */
export function getPlayerId(playerIndex: number): PlayerId {
  return `${config.ludoGameplay.playerPrefix}${playerIndex}` as PlayerId;
}

/**
 * Get Starting Cell
 * @param playerIdx - 1-based player position
 * @param type -  Game Type (classic or quick)
 */
export function getStartingCell(playerIndex: number, type: GameTypes): Cell {
  return config.ludoGameplay.initialPawnPositions[type][
    playerIndex - 1
  ] as Cell;
}

/**
 * Get Player Info from User ID
 */
export function getPlayerFromUserId(table: Table, userId: string): PlayerInfo {
  const { tableInfo } = table;
  const player = tableInfo.players.find((player) => player.userId === userId);
  if (!player) {
    throw new BadRequestException(
      `User ${userId} does not exist on table ${tableInfo.tableId}`,
    );
  }
  return player;
}

/**
 * Get Player ID of the next turn
 *
 * ```
 * 2 players: PL1 --> PL2
 * 3 players: PL1 --> PL3 --> PL2
 * 4 players: PL1 --> PL3 --> PL2 --> PL4
 * ```
 */
export function getNextTurn(table: Table): PlayerId {
  const { tableInfo, tableState } = table;
  const playerOrder = config.ludoGameplay.playerOrder;
  const { currentTurn } = tableState;
  const { players } = tableInfo;
  let nextTurn = currentTurn;
  for (let index = 0; index < 4; index++) {
    nextTurn = playerOrder[nextTurn] as PlayerId;
    const player = players.find(({ playerId }) => playerId === nextTurn);
    if (player && !player.didLeave) {
      break;
    }
  }
  return nextTurn;
}

export function getTurnTimeout(): string {
  return dayjs().add(config.ludoGameplay.turnTime, 'second').toISOString();
}

export function getRemainingPlayers(table: Table): PlayerInfo[] {
  return table.tableInfo.players.filter((player) => !player.didLeave);
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

/**
 * Add User to the player list
 */
export function addPlayerToPlayerList(playerList: Player[], userId: string) {
  const playerPosition = playerList.length + 1;
  playerList.push({
    userId,
    playerId: getPlayerId(playerPosition),
  });
}

/**
 * Get Player info of the current turn
 */
export function getCurrentTurnPlayerOfTable(table: Table): PlayerInfo {
  const { tableInfo, tableState } = table;
  const { currentTurn } = tableState;
  const player = tableInfo.players.find(
    (player) => player.playerId === currentTurn,
  );
  if (!player) {
    throw new InternalServerErrorException(
      `${currentTurn} is not in the player list`,
    );
  }
  return player;
}

/**
 * Get PlayerInfo from User ID
 *
 * @returns `PlayerInfo` of current turn
 * @throws `BadRequestException` if the user is not of current turn
 */
export function getPlayerInfoOrExceptionIfNotCurrentTurn(
  table: Table,
  userId: string,
): PlayerInfo {
  const player = getPlayerFromUserId(table, userId);
  const { playerId } = player;
  const currentTurn = table.tableState.currentTurn;
  if (playerId !== currentTurn) {
    throw new BadRequestException(
      `Current Turn is not for ${playerId}, but for ${currentTurn}`,
    );
  }
  return player;
}

/**
 * Get list of pawns and their respectively available dices from the table state
 */
export function getCanMovePawns({
  currentTurn,
  lastDiceValues,
  pawnPositions,
}: TableState): CanMovePawn[] {
  // Object for grouping by pawnId
  const canMovePanwsObject: { [pawn: string]: CanMovePawn } = {};
  for (const { pawn, position } of pawnPositions) {
    if (!isPawnOfPlayer(pawn, currentTurn)) {
      continue;
    }
    for (const dice of lastDiceValues) {
      if (!canPawnMoveByDice(position, dice)) {
        continue;
      }
      if (canMovePanwsObject[pawn]) {
        canMovePanwsObject[pawn].dices.push(dice);
      } else {
        canMovePanwsObject[pawn] = {
          pawn,
          dices: [dice],
        };
      }
    }
  }
  return Object.values(canMovePanwsObject);
}

/**
 * Check if the pawn can be actually moved by dice value
 *
 * Rules
 * - If the pawn is in the base, only 1 or 6 can move the pawn
 * - If the pawn is on Home Path and the remaining steps to Home is smaller than the dice value, it can not be moved.
 */
export function canPawnMoveByDice(position: Cell, dice: DiceValue): boolean {
  // If pawn is in home, no more move
  if (position === Cell.home) {
    return false;
  }
  // If pawn is in the base, only 1 or 6 can move it to the board
  if (isBasePosition(position)) {
    return dice === DiceValue.d1 || dice === DiceValue.d6;
  }

  // If the pawn is on Home Path and the remaining steps to Home is smaller than the dice value, it can not be moved.
  if (isOnHomePath(position)) {
    const remainingSteps = getRemainingStepsOnHomePath(position);
    return remainingSteps >= dice;
  }

  return true;
}

/** Check if the pawn is of the player
 *
 * (PW1-1, PL1) => true
 *
 * (PW2-3, PL3) => false
 */
export function isPawnOfPlayer(pawn: PawnId, player: PlayerId): boolean {
  return String(pawn)[2] === String(player)[2];
}

/** Check if the position is Base
 *
 * B100, B200, B300, B400 => true
 *
 * Others => false
 */
export function isBasePosition(position: Cell): boolean {
  return position.startsWith('B');
}

/** Check if the position is on the Home Path
 *
 * H101, H203, ... => true
 *
 * Home and Others => false
 */
export function isOnHomePath(position: Cell): boolean {
  return position !== Cell.home && position.startsWith('H');
}

/** Count remaining steps to Home (only cares when the pawn is on the Home Path)
 *
 * H101 => 5
 * H203 => 3
 * Home and Others => -1
 */
export function getRemainingStepsOnHomePath(position: Cell): number {
  if (isOnHomePath(position)) {
    // this can be easily calculated by substract last digit from 6
    // For example, `H203` => 6 - 3 = 3, `H401` => 6 - 1 = 5
    const homePathPosition = Number(position[3]);
    return 6 - homePathPosition;
  } else {
    return -1;
  }
}

/** Get Cell Position after move by the dice
 *
 * @throws `BadRequestException` if the pawn can not move by dice
 */
export function getNextPosition(
  playerId: PlayerId,
  startPosition: Cell,
  dice: DiceValue,
): Cell {
  if (startPosition === Cell.home) {
    throw new BadRequestException(`Already in Home`);
  }
  const fullPath = config.ludoGameplay.movePawnPaths[playerId] as Cell[];
  if (isBasePosition(startPosition)) {
    // If the pawn is in base, only 1 or 6 can actually move the pawn
    if (dice !== DiceValue.d1 && dice !== DiceValue.d6) {
      throw new BadRequestException(
        `1 or 6 needed to move pawn out from the base, but got ${dice}`,
      );
    }
    // the pawn is placed on the first cell
    return fullPath[1] as Cell;
  }
  const remainingStepsOnHomePath = getRemainingStepsOnHomePath(startPosition);
  if (remainingStepsOnHomePath > 0 && remainingStepsOnHomePath < dice) {
    // If pawn is on home path and the remaining step is less than the dice, it can not move
    throw new BadRequestException(
      `${remainingStepsOnHomePath} steps to Home, but got ${dice}`,
    );
  }

  const cellIndex = fullPath.indexOf(startPosition);

  return fullPath[cellIndex + dice];
}

/**
 * Change Pawn Position in table state
 */
export function doMovePawn(
  tableState: TableState,
  nextPanwPosition: PawnPosition,
) {
  const { pawnPositions } = tableState;
  const pawnPositionIndex = pawnPositions.findIndex(
    ({ pawn }) => pawn === nextPanwPosition.pawn,
  );
  const pawnPosition = pawnPositions[pawnPositionIndex];
  pawnPosition.position = nextPanwPosition.position;
}

export function getStartingPosition(pawn: PawnId, gameType: GameTypes): Cell {
  // Get 1-based Player index:  e.g. PW2-3 => 2
  const playerIndex = Number(pawn[2]);
  return config.ludoGameplay.initialPawnPositions[gameType][
    playerIndex - 1
  ] as Cell;
}

/**
 * Construct and Initial Table Info
 */
export function constructInitialTableInfo({
  tableTypeId,
  tableId,
  gameType,
  joinFee,
  players,
  tournamentId,
  roundNo,
}: TableInitParameters): TableInfo {
  const playerInfos: PlayerInfo[] = players.map(
    (player) =>
      ({
        ...player,
        lives: config.ludoGameplay.initialLives,
        didLeave: false,
        canGet6: true,
        got6: false,
      }) as PlayerInfo,
  );

  const initialTableInfo: TableInfo = {
    tableTypeId,
    tableId,
    gameType,
    joinFee,
    players: playerInfos,
    tournamentId,
    roundNo,
  };
  return initialTableInfo;
}

/**
 * Construct and Initial Table State
 */
export function constructInitialTableState({
  tableId,
  gameType,
  players,
  timeout,
}: TableInitParameters): TableState {
  const initialPawnPositions: PawnPosition[] = [];
  const pawnCount = 4;
  for (let playerIndex = 1; playerIndex <= players.length; playerIndex++) {
    for (let pawnIndex = 1; pawnIndex <= pawnCount; pawnIndex++) {
      const pawn = getPawnId(playerIndex, pawnIndex);
      const position = getStartingCell(playerIndex, gameType);
      initialPawnPositions.push({
        pawn,
        position,
      } as PawnPosition);
    }
  }
  const initialTableState: TableState = {
    tableId,
    action: GameAction.rollDice,
    pawnPositions: initialPawnPositions,
    currentTurn: PlayerId.pl1,
    turnNo: 0,
    lastDiceValues: [],
    readyPlayers: [],
    extraChances: 0,
    timeout: timeout ?? getTurnTimeout(),
  };
  return initialTableState;
}

export function getRandomDiceOutcome(canGet6: boolean) {
  return getRandomInteger(1, canGet6 ? 6 : 5);
}

export function calculateScore(table: Table): Scores {
  const { tableInfo, tableState } = table;
  const { gameType, players } = tableInfo;
  const { pawnPositions } = tableState;

  const scores: Scores = {};

  if ([GameTypes.classic, GameTypes.quick].includes(gameType)) {
    return scores;
  }

  const playerIds = players.map(({ playerId }) => playerId);

  for (const playerId of playerIds) {
    scores[playerId] = 0;
    const fullPath = config.ludoGameplay.movePawnPaths[playerId];
    const pawnsOfPlayer = pawnPositions.filter((pawn) =>
      isPawnOfPlayer(pawn.pawn, playerId),
    );
    const distancesFromBase = pawnsOfPlayer.map(
      (pawn) => fullPath.indexOf(pawn.position) - 1,
    );

    for (const distance of distancesFromBase) {
      if (distance > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        scores[playerId]! += distance === 56 ? 2 * distance : distance;
      }
    }
  }
  return scores;
}

export function findWinners(players: PlayerInfo[], scores: Scores): PlayerId[] {
  for (const { didLeave, playerId } of players) {
    if (didLeave) {
      scores[playerId] = 0;
    }
  }
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) {
    // if only one user remains in the game, he will be the winner
    // if more than one user but all got score 0, no winner
    const remainingPlayers = players.filter(({ didLeave }) => !didLeave);
    return remainingPlayers.length === 1 ? [remainingPlayers[0].playerId] : [];
  }
  const winners: PlayerId[] = [];
  for (const playerId in scores) {
    if (scores[playerId as PlayerId] === maxScore) {
      winners.push(playerId as PlayerId);
    }
  }
  return winners;
}

export function getRoundDuration(noPlayers: number): RoundDuration {
  const duration = config.ludoTournament.roundDurations.find(
    (roundDuration) => roundDuration.noPlayers === noPlayers,
  );
  if (!duration) {
    throw new InternalServerErrorException(
      `Not Found duration for ${noPlayers}-player game`,
    );
  }
  return duration;
}

export function getPlayerIndexFromId(playerId: PlayerId): number {
  return Number(playerId[2]);
}

export function getTargetPawns(gameType: GameTypes): number {
  return gameType === GameTypes.quick ? 2 : 4;
}
