import { Model } from 'mongoose';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { config } from '@lib/fabzen-common/configuration';

import {
  PawnPosition,
  Table,
  GameAction,
  PawnId,
  DiceValue,
  Cell,
  NextAction,
  GameStatus,
  PlayerId,
  GameTypes,
  TableID,
  MovePawnResponse,
  SaveGameTableParameter,
  TableInitParameters,
} from '../../ludo-gameplay.types';
import { CommonService } from './common.service';
import { GameTable, GameTableDocument } from '../../model/game-table.schema';
import { RedisTransientDBService } from '../transient-db/redis-backend';
import { LudoQueueService } from '../queue';
import {
  constructInitialTableInfo,
  constructInitialTableState,
  doMovePawn,
  getCanMovePawns,
  getCurrentTurnPlayerOfTable,
  getNextPosition,
  getNextTurn,
  getRandomDiceOutcome,
  getRemainingPlayers,
  getStartingPosition,
  getTurnTimeout,
  isPawnOfPlayer,
  calculateScore,
  getPlayerIndexFromId,
  getPawnId,
  getTargetPawns,
} from '../../utils/ludo-gameplay.utils';
import { LudoGameplayGateway } from '../../ludo-gameplay.gateway';
import { RedisService } from '../redis/service';
import { LudoRemoteConfigService } from '@lib/fabzen-common/remote-config/interfaces';

@Injectable()
export class TableService {
  readonly logger = new Logger(TableService.name);

  constructor(
    @Inject(forwardRef(() => CommonService))
    private commonService: CommonService,
    @Inject(forwardRef(() => LudoQueueService))
    private ludoQueueService: LudoQueueService,
    private readonly ludoGameplayGateway: LudoGameplayGateway,
    @InjectModel(GameTable.name)
    public gameTableModel: Model<GameTableDocument>,
    private readonly transientDBService: RedisTransientDBService,
    private readonly redisService: RedisService,
    private readonly configService: LudoRemoteConfigService,
  ) {}

  /**
   * Construct and Store Table Info and Initial State in redis
   *
   * @returns Table data (Info and State)
   */
  async storeInitialTable(
    tableInitParameters: TableInitParameters,
  ): Promise<Table> {
    const initialTableInfo = constructInitialTableInfo(tableInitParameters);
    const initialTableState = constructInitialTableState(tableInitParameters);
    const initialTable = {
      tableInfo: initialTableInfo,
      tableState: initialTableState,
    };
    await this.storeTable(initialTable);
    return initialTable;
  }

  /**
   * Store both Table in Redis
   */
  async storeTable(table: Table): Promise<void> {
    await this.transientDBService.setActiveTable(table);
  }

  /**
   * Update both Table in Redis
   */
  async updateTable(table: Table): Promise<boolean> {
    const tableId = table.tableInfo.tableId;
    const oldTable = await this.getTable(tableId);
    if (oldTable) {
      await this.transientDBService.setActiveTable(table);
    }
    return !!oldTable;
  }

  /**
   * Get both Table Info and State From Redis
   */
  async getTable(tableId: TableID): Promise<Table | undefined> {
    return this.transientDBService.getActiveTable(tableId);
  }

  async getTables(tableIds: TableID[]): Promise<Map<TableID, Table>> {
    return this.transientDBService.getActiveTables(tableIds);
  }

  async getTableOrThrowException(tableId: string): Promise<Table> {
    const table = await this.getTable(tableId);
    if (!table) {
      throw new BadRequestException(`Table ${tableId} does not exist`);
    }
    return table;
  }

  /**
   * Delete both Table Info and State in Redis
   */
  async removeTable(table: Table) {
    const { tableId, players } = table.tableInfo;
    this.logger.debug(`Game Play log ${tableId}: Removing Table from Redis`);

    await this.transientDBService.deleteActiveTable(tableId);
    for (const { userId, didLeave } of players) {
      if (!didLeave) {
        await this.transientDBService.deleteUserActiveTableId(userId);
      }
    }

    this.ludoGameplayGateway.leaveRoomAllPlayers(tableId);
  }

  /**
   * Store Table info in DB
   */
  async saveGameTable({
    gameType,
    tableId,
    tournamentId,
    joinFee,
    players,
    winAmount,
    roundNo,
    tableTypeId,
  }: SaveGameTableParameter): Promise<void> {
    try {
      await this.gameTableModel.create({
        tableTypeId,
        tableId,
        tournamentId,
        gameType,
        joinFee,
        roundNo,
        winAmount,
        players,
        winner: '[]',
      });
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async rollDice(table: Table): Promise<DiceValue> {
    const { tableInfo, tableState } = table;
    const { tableId, players, gameType } = tableInfo;
    if (tableState.action !== GameAction.rollDice) {
      throw new BadRequestException(
        `Expected ${tableState.action} Request, but got rollDice`,
      );
    }
    if (gameType !== GameTypes.tournament && tableState.turnNo === 0) {
      throw new BadRequestException(`Table is still being initialized`);
    }
    const currentTurnPlayer = getCurrentTurnPlayerOfTable(table);
    const dice = getRandomDiceOutcome(currentTurnPlayer.canGet6);
    const currentTurn = tableState.currentTurn;
    tableState.lastDiceValues.push(dice);
    const timeout = getTurnTimeout();
    tableState.timeout = timeout;
    tableState.turnNo++;
    const nextTurn = getNextTurn(table);
    const sortedPlayers = players.sort((a, b) =>
      a.playerId.localeCompare(b.playerId),
    );
    const lives = sortedPlayers.map((player) => player.lives);
    let nextAction: NextAction;
    if (
      dice === DiceValue.d6 &&
      this.configService.isExtraRollAfterSixEnabled()
    ) {
      currentTurnPlayer.got6 = true;
      const dicesCount = tableState.lastDiceValues.length;
      // If three 6 in a row, then skip turn
      if (
        dicesCount > 2 &&
        tableState.lastDiceValues[dicesCount - 2] === DiceValue.d6 &&
        tableState.lastDiceValues[dicesCount - 3] === DiceValue.d6
      ) {
        currentTurnPlayer.canGet6 = false;
        if (
          players.filter(({ canGet6, didLeave }) => !didLeave && canGet6)
            .length === 0
        ) {
          for (const player of players) {
            player.canGet6 = true;
            player.got6 = false;
          }
        }
        tableState.currentTurn = nextTurn;
        tableState.lastDiceValues = [];
        tableState.action = GameAction.rollDice;
        tableState.extraChances = 0;
        nextAction = {
          player: nextTurn,
          action: GameAction.rollDice,
          timeout,
          lives,
        };
      } else {
        nextAction = {
          player: currentTurn,
          action: GameAction.rollDice,
          timeout,
          lives,
        };
      }
    } else {
      const canMovePawns = getCanMovePawns(tableState);
      if (canMovePawns.length === 0) {
        if (currentTurnPlayer.got6) {
          currentTurnPlayer.canGet6 = false;
          if (
            players.filter(({ canGet6, didLeave }) => !didLeave && canGet6)
              .length === 0
          ) {
            currentTurnPlayer.got6 = false;
            for (const player of players) {
              player.canGet6 = true;
            }
          }
        }
        tableState.currentTurn = nextTurn;
        tableState.lastDiceValues = [];
        tableState.action = GameAction.rollDice;
        tableState.extraChances = 0;
        nextAction = {
          player: nextTurn,
          action: GameAction.rollDice,
          timeout,
          lives,
        };
      } else {
        tableState.action = GameAction.movePawn;
        nextAction = {
          player: currentTurn,
          action: GameAction.movePawn,
          canMovePawns,
          timeout,
          lives,
        };
      }
    }

    await this.updateTable(table);
    this.ludoGameplayGateway.rollDice(tableId, currentTurn, dice);

    setTimeout(async () => {
      try {
        await this.redisService.aquireLock(tableId);
        const table = await this.getTable(tableId);
        // eslint-disable-next-line unicorn/consistent-destructuring
        const currentTurn = table?.tableState.currentTurn;
        if (currentTurn === nextAction.player) {
          this.ludoGameplayGateway.next(tableId, nextAction);
        }
      } finally {
        await this.redisService.releaseLock(tableId);
      }
    }, config.ludoGameplay.movePawnDelay * 1000);

    return dice;
  }

  async movePawn(
    table: Table,
    pawn: PawnId,
    dice: DiceValue,
  ): Promise<MovePawnResponse> {
    const { tableInfo, tableState } = table;
    const { gameType, players } = tableInfo;
    const {
      lastDiceValues,
      pawnPositions,
      currentTurn,
      action: currentAction,
    } = tableState;
    if (currentAction !== GameAction.movePawn) {
      throw new BadRequestException(
        `Expected ${currentAction} Request, but got movePawn`,
      );
    }
    if (!lastDiceValues.includes(dice)) {
      throw new BadRequestException(`No history of dice ${dice}`);
    }
    tableState.turnNo++;
    const currentPlayer = getCurrentTurnPlayerOfTable(table);
    const { playerId, got6 } = currentPlayer;
    if (!isPawnOfPlayer(pawn, playerId)) {
      throw new BadRequestException(`${pawn} is not of ${playerId}`);
    }

    const pawnPosition = pawnPositions.find(
      (pawnPosition) => pawnPosition.pawn === pawn,
    );
    if (!pawnPosition) {
      throw new BadRequestException(`${pawn} is not on the table`);
    }

    const nextPosition = getNextPosition(playerId, pawnPosition.position, dice);
    const movedPawns: PawnPosition[] = [
      {
        pawn,
        position: nextPosition,
        usedDice: dice,
      },
    ];
    // if 2 pawns in quick mode or 4 pawns in classic mode are in home, player wins
    if (nextPosition === Cell.home) {
      const targetPawnCount = getTargetPawns(gameType);

      const pawnCountInHome = pawnPositions.filter(
        ({ pawn: _pawn, position }) =>
          pawn === _pawn ||
          (isPawnOfPlayer(_pawn, currentTurn) && position === Cell.home),
      ).length;
      const scores = calculateScore(table);
      if (targetPawnCount === pawnCountInHome) {
        const winner = getCurrentTurnPlayerOfTable(table);
        return {
          movedPawns,
          scores,
          winner,
        };
      }
    }

    const pawnsOnTheNextPosition = pawnPositions.filter(
      (pawnPosition) => pawnPosition.position === nextPosition,
    );
    // if the next position is Home, player can have an extra chance
    let gotExtraChance = nextPosition === Cell.home;

    // Next position is already occupied by one pawn of other player, and not protected cell nor Home, kill that pawn and move pawn again
    if (
      nextPosition !== Cell.home &&
      pawnsOnTheNextPosition.length === 1 &&
      !isPawnOfPlayer(pawnsOnTheNextPosition[0].pawn, playerId) &&
      !config.ludoGameplay.protectedCells.includes(nextPosition)
    ) {
      gotExtraChance = true;
      const killedPawn = pawnsOnTheNextPosition[0].pawn;
      movedPawns.push({
        pawn: killedPawn,
        position: getStartingPosition(killedPawn, gameType),
      });
    }
    if (gotExtraChance) {
      tableState.extraChances++;
    }

    // Change pawn positions in table state
    for (const nextPawnPosition of movedPawns) {
      doMovePawn(tableState, nextPawnPosition);
    }
    const scores = calculateScore(table);
    const timeout = getTurnTimeout();
    tableState.timeout = timeout;
    const nextTurn = getNextTurn(table);

    lastDiceValues.splice(lastDiceValues.indexOf(dice), 1); // Remove used dice from the list
    const canMovePawns = getCanMovePawns(tableState);
    let nextActionPlayerId = playerId;

    // eslint-disable-next-line unicorn/consistent-destructuring
    if (tableState.extraChances === 0 && canMovePawns.length === 0) {
      if (got6) {
        currentPlayer.canGet6 = false;
        if (
          players.filter(({ canGet6, didLeave }) => !didLeave && canGet6)
            .length === 0
        ) {
          for (const player of players) {
            player.canGet6 = true;
            player.got6 = false;
          }
        }
      }
      nextActionPlayerId = nextTurn;
      tableState.currentTurn = nextActionPlayerId;
      tableState.lastDiceValues = [];
    }

    const action =
      canMovePawns.length === 0 ? GameAction.rollDice : GameAction.movePawn; // Roll Dice if no more available pawn moves
    tableState.action = action;

    // eslint-disable-next-line unicorn/consistent-destructuring
    if (canMovePawns.length === 0 && tableState.extraChances > 0) {
      // if no more available pawn moves, then use extra chance (if has)
      tableState.extraChances--;
    }
    const sortedPlayers = players.sort((a, b) =>
      a.playerId.localeCompare(b.playerId),
    );
    const lives = sortedPlayers.map((player) => player.lives);
    const nextAction: NextAction = {
      player: nextActionPlayerId,
      action,
      canMovePawns,
      timeout,
      lives,
    };

    await this.updateTable(table);

    return {
      movedPawns,
      scores,
      nextAction,
    };
  }

  async skipTurn(table: Table) {
    const { tableState, tableInfo } = table;
    const { players } = tableInfo;
    const nextTurn = getNextTurn(table);
    const timeout = getTurnTimeout();
    const currentPlayer = getCurrentTurnPlayerOfTable(table);

    currentPlayer.lives--;
    // eslint-disable-next-line unicorn/consistent-destructuring
    if (currentPlayer.lives < 0) {
      await this.leaveTable(table, currentPlayer.userId);
    }

    if (currentPlayer.got6) {
      currentPlayer.canGet6 = false;
      if (
        players.filter(({ canGet6, didLeave }) => !didLeave && canGet6)
          .length === 0
      ) {
        for (const player of players) {
          player.canGet6 = true;
          player.got6 = false;
        }
      }
    }
    tableState.action = GameAction.rollDice;
    tableState.lastDiceValues = [];
    tableState.currentTurn = nextTurn;
    tableState.timeout = timeout;
    tableState.extraChances = 0;
    tableState.turnNo++;
    await this.updateTable(table);
    const sortedPlayers = players.sort((a, b) =>
      a.playerId.localeCompare(b.playerId),
    );
    const lives = sortedPlayers.map((player) => player.lives);
    this.ludoGameplayGateway.next(tableState.tableId, {
      player: nextTurn,
      action: GameAction.rollDice,
      lives: lives,
      timeout,
    });
    this.ludoQueueService.addTimeoutAction(
      tableState.tableId,
      GameAction.skipTurn,
      tableState.turnNo + 1,
      config.ludoGameplay.turnTime,
    );
  }

  async discardGame(table: Table) {
    const { tableId, players } = table.tableInfo;

    this.logger.debug(`Game Play log ${tableId}: Game Discarded`);

    // Remove table key
    await this.transientDBService.deleteActiveTable(tableId);

    // remove user table key
    await Promise.all(
      players.map(({ userId }) =>
        this.transientDBService.deleteUserActiveTableId(userId),
      ),
    );
    // Mark as discarded on DB
    await this.gameTableModel.findOneAndUpdate(
      { tableId },
      {
        $set: {
          status: GameStatus.gameDiscarded,
        },
      },
    );
    this.ludoGameplayGateway.discardGame(tableId);
  }

  async leaveTable(table: Table, userId: string) {
    const { tableInfo, tableState } = table;
    const { players, tableId, tournamentId } = tableInfo;
    const { currentTurn } = tableState;
    const playerIndex = players.findIndex((player) => player.userId === userId);
    const leftPlayer = players[playerIndex];
    if (!leftPlayer || leftPlayer.didLeave) {
      return;
    }
    leftPlayer.didLeave = true;
    this.takeOutAllPawns(table, leftPlayer.playerId);
    this.ludoGameplayGateway.leftTable(tableId, leftPlayer);
    const remainingPlayers = getRemainingPlayers(table);
    await this.transientDBService.deleteUserActiveTableId(userId);
    if (remainingPlayers.length === 1) {
      const winner = remainingPlayers[0];
      await this.commonService.endGame(table, [winner.playerId]);
    } else {
      if (leftPlayer.playerId === currentTurn) {
        const nextTurn = getNextTurn(table);
        const timeout = getTurnTimeout();
        tableState.action = GameAction.rollDice;
        tableState.lastDiceValues = [];
        tableState.currentTurn = nextTurn;
        tableState.timeout = timeout;
        tableState.extraChances = 0;
        tableState.turnNo++;
        const sortedPlayers = players.sort((a, b) =>
          a.playerId.localeCompare(b.playerId),
        );
        const lives = sortedPlayers.map((player) => player.lives);
        this.ludoGameplayGateway.next(tableState.tableId, {
          player: nextTurn,
          action: GameAction.rollDice,
          lives: lives,
          timeout,
        });
        this.ludoQueueService.addTimeoutAction(
          tableState.tableId,
          GameAction.skipTurn,
          // eslint-disable-next-line unicorn/consistent-destructuring
          tableState.turnNo + 1,
          config.ludoGameplay.turnTime,
        );
      }

      await this.updateTable(table);

      // if this is tournament, make him loser so that he/she can't come back to game
      if (tournamentId) {
        this.commonService.makeTournamentLoser(tournamentId, userId);
      }
    }
  }

  private takeOutAllPawns(table: Table, playerId: PlayerId) {
    const { pawnPositions } = table.tableState;
    const playerIndex = getPlayerIndexFromId(playerId);
    const pawnCount = 4;
    const indexesToRemove = [];
    for (let pawnIndex = 1; pawnIndex <= pawnCount; pawnIndex++) {
      indexesToRemove.push(
        pawnPositions.findIndex(
          ({ pawn }) => pawn === getPawnId(playerIndex, pawnIndex),
        ),
      );
    }
    indexesToRemove.sort((a, b) => b - a);
    for (const index of indexesToRemove) {
      pawnPositions.splice(index, 1);
    }
  }
}
