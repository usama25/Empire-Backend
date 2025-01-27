import * as dayjs from 'dayjs';

import {
  getRandomInteger,
  getRandomString,
} from '@lib/fabzen-common/utils/random.utils';
import { PlayerId } from '@lib/fabzen-common/types';
import {
  compressString,
  decompressString,
} from '@lib/fabzen-common/utils/string.utils';

import { Pawn } from './pawn.entity';
import {
  CanMovePawn,
  GameAction,
  PawnId,
  PawnPosition,
  Position,
} from './types';
import {
  BONUS_PER_HOME_LANDING,
  BONUS_PER_REMAINING_MOVE,
  BONUS_PER_SECOND,
  INITIAL_LIVES,
  SAFE_POSITIONS,
  TABLE_ID_LENGTH,
  TOTAL_MOVES,
  TURN_TIMEOUT_IN_SECONDS,
} from './constants';
import { BadRequestException } from '@nestjs/common';
import { MovePawnResponseEvent, NextActionEvent } from '../use-cases';

export class LudoMegaTournamentGameTable {
  public id: string;
  public tournamentId: string;
  public userId: string;
  public rollDiceActionBonus: number;
  public bonus: number;
  public score: number;
  public pawns: Pawn[];
  public action: GameAction;
  public timeout: string;
  public dices: number[];
  public counter: number;
  public lives: number;
  public remainingMoves: number;
  public lastActionStartTime: string;
  public isNewTurn: boolean;

  constructor({
    tournamentId,
    userId,
    id,
    bonus,
    rollDiceActionBonus,
    score,
    pawnPositions,
    action,
    timeout,
    dices,
    counter,
    lives,
    remainingMoves,
    lastActionStartTime,
    isNewTurn,
    totalMoves,
  }: {
    tournamentId: string;
    userId: string;
    id?: string;
    bonus?: number;
    rollDiceActionBonus?: number;
    score?: number;
    pawnPositions?: PawnPosition[];
    action?: GameAction;
    timeout?: string;
    dices?: number[];
    counter?: number;
    lives?: number;
    remainingMoves?: number;
    lastActionStartTime?: string;
    isNewTurn?: boolean;
    totalMoves?: number;
  }) {
    this.id = id ?? this.#generateTableId();
    this.tournamentId = tournamentId;
    this.userId = userId;
    this.bonus = bonus ?? 0;
    this.rollDiceActionBonus = rollDiceActionBonus ?? 0;
    this.score = score ?? 0;
    this.pawns = pawnPositions
      ? pawnPositions.map((pawnPosition) => Pawn.fromPawnPosition(pawnPosition))
      : [];
    this.action = action ?? GameAction.rollDice;
    this.timeout = timeout ?? dayjs().toISOString();
    this.dices = dices ?? [];
    this.counter = counter ?? 0;
    this.lives = lives ?? INITIAL_LIVES;
    this.remainingMoves = remainingMoves ?? totalMoves ?? TOTAL_MOVES;
    this.lastActionStartTime = lastActionStartTime ?? dayjs().toISOString();
    this.isNewTurn = isNewTurn ?? true;
  }

  #generateTableId(): string {
    return getRandomString(TABLE_ID_LENGTH);
  }

  public static create(
    tournamentId: string,
    userId: string,
    totalMoves: number,
    initialPawnPositions: PawnPosition[],
  ): LudoMegaTournamentGameTable {
    const table = new LudoMegaTournamentGameTable({
      tournamentId,
      userId,
      totalMoves,
    });
    table.#putPawnsOnTable(initialPawnPositions);
    return table;
  }

  public static getRandomInitialPositions(): PawnPosition[] {
    const initialPawnPositions: PawnPosition[] = [];
    const excludePositions: Position[] = [...SAFE_POSITIONS] as Position[];
    for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
      for (let pawnIndex = 0; pawnIndex < 4; pawnIndex++) {
        const pawn = new Pawn(playerIndex, pawnIndex, Position.home);
        const position =
          playerIndex === 0
            ? pawn.getBasePosition()
            : pawn.getRandomPosition(excludePositions);
        excludePositions.push(position);
        const pawnPosition: PawnPosition = { pawn: pawn.getPawnId(), position };
        initialPawnPositions.push(pawnPosition);
      }
    }
    return initialPawnPositions;
  }

  #putPawnsOnTable(initialPawnPositions: PawnPosition[]) {
    for (const pawnPosition of initialPawnPositions) {
      const pawn = Pawn.fromPawnPosition(pawnPosition);
      this.pawns.push(pawn);
    }
  }

  public getPawnPositions(): PawnPosition[] {
    return this.pawns.map((pawn) => pawn.toPawnPosition());
  }

  public serialze(): string {
    const stringifiedTable = this.toString();
    return compressString(stringifiedTable);
  }

  public static deserialize(
    serializedTable: string,
  ): LudoMegaTournamentGameTable {
    const stringifiedTable = decompressString(serializedTable);
    const table = JSON.parse(stringifiedTable);
    return new LudoMegaTournamentGameTable(table);
  }

  public toString(): string {
    return JSON.stringify({
      id: this.id,
      tournamentId: this.tournamentId,
      userId: this.userId,
      bonus: this.bonus,
      score: this.score,
      rollDiceActionBonus: this.rollDiceActionBonus,
      pawnPositions: this.getPawnPositions(),
      action: this.action,
      timeout: this.timeout,
      dices: this.dices,
      counter: this.counter,
      lives: this.lives,
      remainingMoves: this.remainingMoves,
      lastActionStartTime: this.lastActionStartTime,
      isNewTurn: this.isNewTurn,
    });
  }

  public toReconnectionData(): any {
    return {
      tableId: this.id,
      pawnPositions: this.getPawnPositions(),
      action: this.action,
      dices: this.dices,
      timeout: this.timeout,
      canMovePawns:
        this.action === GameAction.movePawn ? this.#getCanMovePanws() : [],
      totalMoves: this.remainingMoves,
      score: this.calculateTotalScore(),
      myPlayerId: PlayerId.pl1,
      lives: this.lives,
      tournamentId: this.tournamentId,
    };
  }

  public generateNextAction(): NextActionEvent {
    let canMovePawns: CanMovePawn[] | undefined;
    if (this.action === GameAction.movePawn) {
      canMovePawns = this.#getCanMovePanws();
    }
    return {
      tableId: this.id,
      action: this.action,
      timeout: this.timeout,
      canMovePawns,
      lives: this.lives,
      remainingMoves: this.remainingMoves,
      isNewTurn: this.isNewTurn,
    };
  }

  #getCanMovePanws(): CanMovePawn[] {
    // Need Improvement
    const canMovePanwsObject: { [pawn: string]: CanMovePawn } = {};
    for (const pawn of this.pawns) {
      const { playerIndex, position } = pawn;
      const pawnId = pawn.getPawnId();
      if (playerIndex !== 0) {
        continue;
      }
      for (const dice of this.dices) {
        if (!this.#canPawnMoveByDice(position, dice)) {
          continue;
        }
        if (canMovePanwsObject[pawnId]) {
          canMovePanwsObject[pawnId].dices.push(dice);
        } else {
          canMovePanwsObject[pawnId] = {
            pawn: pawnId,
            dices: [dice],
          };
        }
      }
    }
    return Object.values(canMovePanwsObject);
  }

  #canPawnMoveByDice(position: Position, dice: number): boolean {
    // If pawn is in home, no more move
    if (position === Position.home) {
      return false;
    }
    // If pawn is in the base, only 1 or 6 can move it to the board
    if (LudoMegaTournamentGameTable.isBasePosition(position)) {
      return dice === 1 || dice === 6;
    }

    // If the pawn is on Home Path and the remaining steps to Home is smaller than the dice value, it can not be moved.
    if (LudoMegaTournamentGameTable.isOnHomePath(position)) {
      const remainingSteps =
        LudoMegaTournamentGameTable.getRemainingStepsOnHomePath(position);
      return remainingSteps >= dice;
    }

    return true;
  }

  static isBasePosition(position: Position): boolean {
    return position.startsWith('B');
  }

  static isOnHomePath(position: Position): boolean {
    return position !== Position.home && position.startsWith('H');
  }

  static getRemainingStepsOnHomePath(position: Position): number {
    if (LudoMegaTournamentGameTable.isOnHomePath(position)) {
      // this can be easily calculated by substract last digit from 6
      // For example, `H203` => 6 - 3 = 3, `H401` => 6 - 1 = 5
      const homePathPosition = Number(position[3]);
      return 6 - homePathPosition;
    } else {
      return -1;
    }
  }

  #getActionTimeout(): string {
    return dayjs().add(TURN_TIMEOUT_IN_SECONDS, 'seconds').toISOString();
  }

  public rollDice(isExtraRollAfterSixEnabled: boolean): {
    dice: number;
    skippedMove: MovePawnResponseEvent | undefined;
  } {
    if (this.action !== GameAction.rollDice) {
      throw new BadRequestException(
        `Expected ${this.action} Request, but got rollDice`,
      );
    }

    const dice = this.#getRandomDiceOutcome();
    this.dices.push(dice);
    this.isNewTurn = false;

    this.#creditActionBonus(true);

    let skippedMove: MovePawnResponseEvent | undefined = undefined;

    // If three 6 in a row, then clear all, and start over again
    if (this.#gotThree6()) {
      this.dices = [];
      this.remainingMoves--;
      this.rollDiceActionBonus = 0;
      this.isNewTurn = true;
    }

    const canMovePawns = this.#getCanMovePanws();
    if (dice !== 6 || !isExtraRollAfterSixEnabled) {
      if (canMovePawns.length > 0) {
        this.action = GameAction.movePawn;
      } else {
        // If no pawn can move, then credit the bonus, and move to the next turn
        const bonusForDices = this.dices.reduce((sum, dice) => sum + dice, 0);
        const actionBonus = this.#creditActionBonus(false);
        this.bonus += bonusForDices;
        this.dices = [];
        this.remainingMoves--;
        this.isNewTurn = true;

        const oneOutPawn = this.pawns.find(
          ({ playerIndex, position }) =>
            playerIndex === 0 && position !== Position.home,
        ) as Pawn;

        skippedMove = {
          tableId: this.id,
          movedPawns: [
            {
              pawn: oneOutPawn.getPawnId(),
              position: oneOutPawn.position,
            },
          ],
          score: this.calculateTotalPointsOfMyPawns(),
          bonus: actionBonus,
          totalBonus: this.bonus,
          turnScore: bonusForDices,
          gotExtraMove: false,
        };
      }
    }

    this.incrementCounterAndTimeout();
    return { dice, skippedMove };
  }

  #creditActionBonus(forRollDice: boolean): number {
    const bonus = this.#getActionBonus();
    let creditedBonus = 0;
    if (forRollDice) {
      this.rollDiceActionBonus += bonus;
    } else {
      creditedBonus = this.rollDiceActionBonus + bonus;
      this.bonus += creditedBonus;
      this.rollDiceActionBonus = 0;
    }
    return creditedBonus;
  }

  #getActionBonus() {
    const consumedTimeInSeconds = dayjs().diff(
      this.lastActionStartTime,
      'seconds',
    );
    const secondsForBonus = TURN_TIMEOUT_IN_SECONDS - consumedTimeInSeconds;
    return Math.ceil(secondsForBonus * BONUS_PER_SECOND * 100) / 100;
  }

  public incrementCounterAndTimeout() {
    this.counter++;
    this.timeout = this.#getActionTimeout();
    this.lastActionStartTime = dayjs().toISOString();
  }

  #getRandomDiceOutcome(): number {
    return getRandomInteger(1, 6);
  }

  #gotThree6(): boolean {
    return this.dices.length === 3 && this.dices.every((dice) => dice === 6);
  }

  public movePawn(pawnId: PawnId, dice: number): MovePawnResponseEvent {
    if (this.action !== GameAction.movePawn) {
      throw new BadRequestException(
        `Expected ${this.action} Request, but got movePawn`,
      );
    }
    if (!this.dices.includes(dice)) {
      throw new BadRequestException(`No history of Dice ${dice}`);
    }
    const pawn = this.#findPawn(pawnId);
    const nextPosition = pawn.getNextPosition(dice);
    if (nextPosition === Position.home) {
      pawn.creditBonus(BONUS_PER_HOME_LANDING);
    }
    pawn.moveTo(nextPosition);
    const movedPawns: PawnPosition[] = [
      {
        pawn: pawnId,
        position: nextPosition,
        usedDice: dice,
        points: pawn.calculatePoints(),
      },
    ];

    const pawnsToKillOnNextPosition =
      this.#getOtherPawnsToKillOnPosition(nextPosition);
    for (const pawnToKill of pawnsToKillOnNextPosition) {
      const basePosition = pawnToKill.getBasePosition();
      const pointsOfPawn = pawnToKill.calculatePoints();
      pawn.creditBonus(pointsOfPawn);
      pawnToKill.moveTo(basePosition);
      movedPawns.push({
        pawn: pawnToKill.getPawnId(),
        position: basePosition,
        points: 0,
      });
    }
    let gotExtraMove = false;
    if (this.#haveExtraChance(nextPosition, pawnsToKillOnNextPosition)) {
      this.remainingMoves++;
      gotExtraMove = true;
    }

    this.dices.splice(this.dices.indexOf(dice), 1); // Remove used dice from the list
    const canMovePawns = this.#getCanMovePanws();
    let bonusForDices = 0;
    if (canMovePawns.length === 0) {
      this.action = GameAction.rollDice;
      bonusForDices = this.dices.reduce((sum, dice) => sum + dice, 0);
      this.bonus += bonusForDices;
      this.dices = [];
      this.remainingMoves--;
      this.isNewTurn = true;
    }

    const creditedBonus = this.#creditActionBonus(false);
    this.incrementCounterAndTimeout();
    const score = this.calculateTotalPointsOfMyPawns();
    const turnScore = score - this.score;
    this.score = score;

    return {
      tableId: this.id,
      movedPawns,
      score,
      bonus: creditedBonus + bonusForDices,
      totalBonus: this.bonus,
      turnScore,
      gotExtraMove,
    };
  }

  #findPawn(pawnId: PawnId): Pawn {
    const pawn = this.pawns.find((pawn) => pawn.getPawnId() === pawnId);
    if (!pawn) {
      throw new BadRequestException(`Pawn ${pawnId} Not Found`);
    }
    return pawn;
  }

  #getOtherPawnsToKillOnPosition(position: Position): Pawn[] {
    return this.pawns.filter(
      (pawn) =>
        pawn.playerIndex !== 0 &&
        pawn.position === position &&
        !SAFE_POSITIONS.includes(position),
    );
  }

  #haveExtraChance(landedPosition: Position, killedPawns: Pawn[]): boolean {
    return landedPosition === Position.home || killedPawns.length > 0;
  }

  public skipTurn() {
    this.lives--;
    this.remainingMoves--;
    this.isNewTurn = true;
    this.action = GameAction.rollDice;
    this.dices = [];
    this.rollDiceActionBonus = 0;
    this.incrementCounterAndTimeout();
  }

  public calculateTotalPointsOfMyPawns(): number {
    const myPawns = this.pawns.filter((pawn) => pawn.playerIndex === 0);
    return myPawns.reduce((score, pawn) => score + pawn.calculatePoints(), 0);
  }

  public calculateTotalScore(): number {
    return this.bonus + this.calculateTotalPointsOfMyPawns();
  }

  public shouldEndGame(): boolean {
    const pawnCountOnHome = this.getHomePawnCount();
    return this.remainingMoves <= 0 || this.lives < 0 || pawnCountOnHome === 4;
  }

  public getHomePawnCount(): number {
    return this.pawns.filter(
      (pawn) => pawn.playerIndex === 0 && pawn.position === Position.home,
    ).length;
  }

  public alreadyStarted(): boolean {
    return this.counter > 0;
  }

  public creditBonusForRemainingMoves(): number {
    const bonus = this.remainingMoves * BONUS_PER_REMAINING_MOVE;
    this.bonus += bonus;
    return bonus;
  }
}
