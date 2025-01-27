import * as dayjs from 'dayjs';
import { Pawn } from './pawn.entity';
import {
  getRandomString,
  getRandomInteger,
} from '@lib/fabzen-common/utils/random.utils';
import {
  GameAction,
  PawnId,
  PawnPosition,
  PlayerId,
  SLGameBoard,
} from './types';
import { GameStatus } from '../use-cases/types';
import { UserGameDetails, UserSLGameInfo } from '@lib/fabzen-common/types';
import { INITIAL_LIVES, TABLE_ID_LENGTH } from './constants';
import {
  compressString,
  decompressString,
} from '@lib/fabzen-common/utils/string.utils';
import { NextActionEvent } from '../use-cases/types';
import { CanMovePawn, Position } from './types';
import { BadRequestException } from '@nestjs/common';

export class SLGameTable {
  public id: string;
  public users: UserSLGameInfo[];
  public currentTurn: string;
  public pawns: Pawn[];
  public action: GameAction;
  public status: GameStatus;
  public timeout: string;
  public dice: number;
  public counter: number;
  public endAt: string;
  public startedAt: Date;
  public updatedAt: Date;
  public joinFee: string;
  public winAmount: string;
  public turnTimeout: number;
  constructor({
    users,
    id,
    currentTurn,
    joinFee,
    winAmount,
    pawnPositions,
    action,
    status,
    timeout,
    turnTimeout,
    dice,
    counter,
    endAt,
    startedAt,
    updatedAt,
  }: {
    users: UserSLGameInfo[];
    id?: string;
    currentTurn?: string;
    pawnPositions?: PawnPosition[];
    action?: GameAction;
    status?: GameStatus;
    timeout: string;
    turnTimeout: number;
    dice?: number;
    counter?: number;
    endAt: string;
    startedAt: Date;
    updatedAt: Date;
    joinFee?: string;
    winAmount?: string;
  }) {
    this.id = id ?? this.#generateTableId();
    this.users = users;
    this.currentTurn = currentTurn ?? users[0].userId;
    this.pawns = pawnPositions
      ? pawnPositions.map((pawnPosition) => Pawn.fromPawnPosition(pawnPosition))
      : [];
    this.action = action ?? GameAction.rollDice;
    this.status = status ?? GameStatus.waiting;
    this.timeout = timeout;
    this.turnTimeout = turnTimeout;
    this.dice = dice ?? 0;
    this.counter = counter ?? 0;
    this.endAt = endAt;
    this.startedAt = startedAt;
    this.updatedAt = updatedAt;
    this.joinFee = joinFee ?? '0';
    this.winAmount = winAmount ?? '0';
  }

  #generateTableId(): string {
    return getRandomString(TABLE_ID_LENGTH);
  }

  public static create(
    userDetails: UserGameDetails[],
    joinFee: string,
    winAmount: string | undefined,
    status: GameStatus,
    timeout: string,
    turnTimeout: number,
    endAt: string,
  ): SLGameTable {
    const users: UserSLGameInfo[] = [];
    let index = 0;
    for (const user of userDetails) {
      users.push({
        playerId: `PL${index + 1}` as PlayerId,
        lives: INITIAL_LIVES,
        didLeave: false,
        ...user,
      });
      index++;
    }
    const pawnPositions: PawnPosition[] = [];
    for (let playerIndex = 0; playerIndex < users.length; playerIndex++) {
      for (let pawnIndex = 0; pawnIndex < 2; pawnIndex++) {
        const pawn = new Pawn(playerIndex, pawnIndex, Position.base);
        pawnPositions.push(pawn.toPawnPosition());
      }
    }

    const table = new SLGameTable({
      users,
      joinFee,
      winAmount,
      status,
      pawnPositions,
      timeout,
      turnTimeout,
      endAt,
      startedAt: new Date(),
      updatedAt: new Date(),
    });
    return table;
  }

  public getPawnPositions(): PawnPosition[] {
    return this.pawns.map((pawn) => pawn.toPawnPosition());
  }

  public serialize(): string {
    const stringfiledTable = this.toString();
    return compressString(stringfiledTable);
  }

  public static deserialize(serializedTable: string): SLGameTable {
    const stringifiedTable = decompressString(serializedTable);
    const table = JSON.parse(stringifiedTable);
    return new SLGameTable(table);
  }

  public toString(): string {
    return JSON.stringify({
      id: this.id,
      users: this.users,
      currentTurn: this.currentTurn,
      pawnPositions: this.getPawnPositions(),
      action: this.action,
      timeout: this.timeout,
      turnTimeout: this.turnTimeout,
      dice: this.dice,
      counter: this.counter,
      endAt: this.endAt,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt,
      joinFee: this.joinFee,
      winAmount: this.winAmount,
    });
  }

  public incrementCounterAndTimeout() {
    this.counter++;
    this.timeout = this.#getActionTimeout();
  }

  #getActionTimeout(): string {
    return dayjs().add(this.turnTimeout, 'seconds').toISOString();
  }

  public setNextTurn(userId: string) {
    const users = this.users;
    const currentIndex = this.users.findIndex((item) => item.userId === userId);
    let found = false;
    let cnt = currentIndex + 1;
    while (!found) {
      if (users[cnt % users.length].didLeave) {
        cnt++;
        continue;
      }
      found = true;
      this.currentTurn = users[cnt % users.length].userId;
    }

    return this.currentTurn;
  }

  public rollDice(): number {
    if (this.action !== GameAction.rollDice) {
      throw new BadRequestException(
        `Expected ${this.action} Request, but got rollDice`,
      );
    }
    const dice = this.#getRandomDiceOutcome();
    this.dice = dice;
    this.counter++;
    this.timeout = this.#getActionTimeout();

    return dice;
  }

  #isHome(landedPosition: Position): boolean {
    return landedPosition === Position.home;
  }

  public movePawn(
    tableId: string,
    pawnId: PawnId,
    dice: number,
    slGameBoard: SLGameBoard,
  ) {
    if (!this.#canPawnMove(pawnId)) {
      throw new BadRequestException(`Can not move ${pawnId}`);
    }
    if (this.action !== GameAction.movePawn) {
      throw new BadRequestException(
        `Expected ${this.action} Request, but got movePawn`,
      );
    }
    if (this.dice !== dice) {
      throw new BadRequestException(`No history of Dice ${dice}`);
    }
    const [playerIndex, pawnIndex] = pawnId
      .replace('PW', '')
      .split('-')
      .map((index) => Number.parseInt(index, 10) - 1);
    if (
      playerIndex !==
      this.users.findIndex((user) => user.userId === this.currentTurn)
    ) {
      throw new BadRequestException(`Invalid pawnId`);
    }
    const targetPawnIndex = this.pawns.findIndex(
      (pawn) =>
        pawn.pawnIndex === pawnIndex && pawn.playerIndex === playerIndex,
    );
    const currentPosition = this.pawns[targetPawnIndex].position;
    const { nextPosition, nextIndex, isLadder, isSnake } = this.pawns[
      targetPawnIndex
    ].getNextPosition(dice, slGameBoard as SLGameBoard);

    //TODO: check if there is another pawn in that position. if so, get an extran turn and send killed pawn to the base
    let isHomeFlag = false;
    let killPawnFlag = false;
    const killedPawnId: PawnId[] = [];
    const pawnsOnNextPosition = this.#getOtherPawnsOnPosition(nextPosition);
    if (pawnsOnNextPosition.length > 0) {
      killPawnFlag = true;
      for (const pawnToKill of pawnsOnNextPosition) {
        killedPawnId.push(pawnToKill.getPawnId());
        pawnToKill.moveTo(Position.base);
      }
    }
    this.pawns[targetPawnIndex].moveTo(nextPosition);
    const movedPawns: PawnPosition = {
      pawn: pawnId,
      position: nextPosition,
      usedDice: dice,
      points: this.pawns[targetPawnIndex].calculatePoints(),
    };
    if (this.#isHome(nextPosition)) {
      isHomeFlag = true;
    }
    let position = ``;
    if (isLadder) {
      position = `${this.pos2number(
        currentPosition,
      )},L${nextIndex},${this.pos2number(movedPawns.position)}`;
    } else if (isSnake) {
      position = `${this.pos2number(
        currentPosition,
      )},S${nextIndex},${this.pos2number(movedPawns.position)}`;
    } else {
      position = `${this.pos2number(currentPosition)},${this.pos2number(
        movedPawns.position,
      )}`;
    }
    this.counter++;
    this.timeout = this.#getActionTimeout();
    const movePawnResponseEvent = {
      tableId,
      playerId: `PL${playerIndex + 1}` as PlayerId,
      pawnId: pawnId,
      position,
      dice: movedPawns.usedDice,
      score: this.score2string(this.calculateTotalPointsOfMyPawns(playerIndex)),
    };
    const killPawnResponse = {
      playerId: `PL${playerIndex + 1}` as PlayerId,
      turnTimeout: this.timeout,
      killPawnId: killedPawnId[0],
      scores: this.getAllusersScore(),
    };
    const requireLongerDelay = isLadder || isSnake;
    return {
      requireLongerDelay,
      movePawnResponseEvent,
      isHomeFlag,
      killPawnFlag,
      killPawnResponse,
    };
  }

  //caution: if there are 2 pawns of same player in the next position, then they are never killed.
  //caution: only alone pawn can be killed by coming pawns
  #getOtherPawnsOnPosition(position: Position): Pawn[] {
    if (position === Position.home) {
      return [];
    }

    const currentPlayerIndex = this.users.findIndex(
      (user) => user.userId === this.currentTurn,
    );

    const pawnsOnPosition = this.pawns.filter(
      (pawn) =>
        pawn.position === position && !this.users[pawn.playerIndex].didLeave,
    );

    if (pawnsOnPosition.length !== 1) {
      return [];
    }

    return pawnsOnPosition[0].playerIndex === currentPlayerIndex
      ? []
      : pawnsOnPosition;
  }

  public getAllusersScore(): string[] {
    const users = this.users;
    const scores: string[] = [];
    for (let id = 0; id < users.length; id++) {
      scores.push(this.score2string(this.calculateTotalPointsOfMyPawns(id)));
    }
    return scores;
  }

  public score2string(score: number[]): string {
    let sum: number = 0;
    for (const value of score) {
      sum += value;
    }
    return sum.toString();
  }

  public pos2number(position: Position): number {
    switch (position) {
      case Position.home: {
        return 100;
      }
      case Position.base: {
        return 0;
      }
      default: {
        return Number.parseInt(position, 10);
      }
    }
  }

  public calculateTotalPointsOfMyPawns(playerIndex: number): number[] {
    const score: number[] = [];

    const myPawns = this.pawns.filter(
      (pawn) => pawn.playerIndex === playerIndex,
    );
    for (const pawn of myPawns) {
      score.push(pawn.calculatePoints());
    }
    return score;
  }

  public findPawn(pawnId: PawnId): Pawn {
    const pawn = this.pawns.find((pawn) => pawn.getPawnId() === pawnId);
    console.log('findPawn--', pawn);
    if (!pawn) {
      throw new BadRequestException(`Pawn ${pawnId} Not Found`);
    }
    return pawn;
  }

  public generateNextAction(): NextActionEvent {
    let canMovePawns: CanMovePawn[] | undefined;
    if (this.action === GameAction.movePawn) {
      const index = this.users.findIndex(
        (user) => user.userId === this.currentTurn,
      );
      canMovePawns = this.getCanMovePanwsByplayerIndex(index);
    }
    const user = this.users.find(
      (user) => user.userId === this.currentTurn && user.didLeave === false,
    );
    const canMovePawnsInString: string[] = [];
    if (canMovePawns) {
      for (const canMovePanw of canMovePawns) {
        canMovePawnsInString.push(canMovePanw.pawnId.toString());
      }
    }

    return {
      tableId: this.id,
      playerId: user?.playerId,
      action: this.action,
      turnTimeout: this.timeout,
      canMovePawns: canMovePawnsInString,
    };
  }

  public getPawnsByIndex(index: number): Pawn[] {
    const pawns: Pawn[] = [];
    for (const pawn of this.pawns) {
      if (pawn.playerIndex === index) {
        pawns.push(pawn);
      }
    }
    return pawns;
  }
  public getCanMovePanwsByplayerIndex(index: number): CanMovePawn[] {
    const canMovePanwsObject: CanMovePawn[] = [];

    const myPawns = this.getPawnsByIndex(index);
    let predictablePos = 0;
    for (const pawn of myPawns) {
      const pawnId = pawn.getPawnId();
      predictablePos = this.dice + pawn.calculatePoints();
      if (pawn.position === Position.home || predictablePos > 100) {
        continue;
      }
      canMovePanwsObject.push({
        pawnId: pawnId,
        dice: this.dice,
      });
    }
    return canMovePanwsObject;
  }

  #canPawnMove(pawnId: PawnId): boolean {
    // Extract playerIndex and pawnIndex from the pawnId
    const [playerIndexString, pawnIndexString] = pawnId
      .replace('PW', '')
      .split('-');
    const playerIndex = Number.parseInt(playerIndexString, 10) - 1;
    const pawnIndex = Number.parseInt(pawnIndexString, 10) - 1;

    // Find the pawn based on playerIndex and pawnIndex
    const pawn = this.pawns.find(
      (pawn) =>
        pawn.pawnIndex === pawnIndex && pawn.playerIndex === playerIndex,
    );
    // Check if the pawn is in the home position
    if (pawn) {
      const predictablePos = this.dice + pawn.calculatePoints();
      return pawn?.position !== Position.home && predictablePos <= 100;
    }
    return false;
  }

  static isBasePosition(position: Position): boolean {
    return position.startsWith('B');
  }

  static isOnHomePath(position: Position): boolean {
    return position !== Position.home && position.startsWith('H');
  }

  #getRandomDiceOutcome(): number {
    return getRandomInteger(1, 6);
  }

  //if two pawns of same player are in the home, the game should be finished
  public shouldEndGame(): boolean {
    // Filter pawns that are at the 'home' position
    const homePawns = this.pawns.filter(
      (pawn) => pawn.position === Position.home,
    );

    // Create a Map to count occurrences of each playerIndex
    const playerIndexCount = new Map<number, number>();
    for (const pawn of homePawns) {
      playerIndexCount.set(
        pawn.playerIndex,
        (playerIndexCount.get(pawn.playerIndex) || 0) + 1,
      );
    }

    // Check if any player has exactly 2 pawns at 'home' position
    for (const count of playerIndexCount.values()) {
      if (count === 2) {
        return true;
      }
    }

    return false;
  }

  public getNumberOfPawnsToBeMoved(): number {
    const pawnsToBeMoved = [];
    const index = this.users.findIndex(
      (user) => user.userId === this.currentTurn,
    );
    for (const pawn of this.pawns) {
      const pawnId = pawn.getPawnId();
      if (pawn.playerIndex !== index || pawn.position === Position.home) {
        continue;
      }
      pawnsToBeMoved.push(pawnId);
    }
    return pawnsToBeMoved.length;
  }

  public checkIfPassTurnToNext(userId: string, gameTable: SLGameTable) {
    const { currentTurn } = gameTable;
    const { users } = gameTable;
    const index = users.findIndex((user) => user.userId === currentTurn);

    const canMovePawns = gameTable.getCanMovePanwsByplayerIndex(index);
    const numberOfPawnsToBeMoved = gameTable.getNumberOfPawnsToBeMoved();
    return numberOfPawnsToBeMoved > 0 && canMovePawns.length === 0;
  }

  public skipTurn(gameTable: SLGameTable) {
    const { currentTurn } = gameTable;
    const { users } = gameTable;
    const index = users.findIndex((user) => user.userId === currentTurn);
    let shouldLeave = true;

    const canMovePawns = gameTable.getCanMovePanwsByplayerIndex(index);
    const numberOfPawnsToBeMoved = gameTable.getNumberOfPawnsToBeMoved();

    if (users[index].lives > 0) {
      if (numberOfPawnsToBeMoved > 0) {
        if (canMovePawns.length > 0) {
          // Case 1: Lives should be reduced
          users[index].lives--;
          gameTable.action = GameAction.rollDice;
          gameTable.counter++;
          gameTable.timeout = this.#getActionTimeout();
          shouldLeave = false;
        } else {
          // Case 2: Lives should not be reduced
          gameTable.action = GameAction.rollDice;
          gameTable.counter++;
          gameTable.timeout = this.#getActionTimeout();
          shouldLeave = false;
        }
      } else {
        // Case 3: No pawns to be moved, lives should not be decreased
        gameTable.action = GameAction.rollDice;
        gameTable.counter++;
        gameTable.timeout = this.#getActionTimeout();
        shouldLeave = false;
      }
    } else {
      // Case 4: Player has no lives left, must leave the table
      shouldLeave = true;
    }

    return { gameTable, shouldLeave };
  }
}
