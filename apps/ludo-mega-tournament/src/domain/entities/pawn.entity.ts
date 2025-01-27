import { BadRequestException } from '@nestjs/common';

import { getRandomInteger } from '@lib/fabzen-common/utils/random.utils';

import { PAWN_PATHS } from './constants';
import { PawnId, PawnPosition, Position } from './types';
import { LudoMegaTournamentGameTable } from './table.entity';

export class Pawn {
  constructor(
    public playerIndex: number,
    public pawnIndex: number,
    public position: Position,
    public bonus?: number,
  ) {}

  public static fromPawnPosition({
    pawn,
    position,
    bonus,
  }: PawnPosition): Pawn {
    // PW1-1 => [0, 0], PW2-1 => [1, 0], PW3-1 => [2, 0], PW4-1 => [3, 0] ...
    const [playerIndex, pawnIndex] = pawn
      .replace('PW', '')
      .split('-')
      .map((index) => Number.parseInt(index, 10) - 1);
    return new Pawn(playerIndex, pawnIndex, position, bonus);
  }

  public toPawnPosition(): PawnPosition {
    return {
      pawn: this.getPawnId(),
      position: this.position,
      points: this.calculatePoints(),
      bonus: this.bonus,
    };
  }

  getPawnId(): PawnId {
    return `PW${this.playerIndex + 1}-${this.pawnIndex + 1}` as PawnId;
  }

  public calculatePoints(): number {
    const fullPath = PAWN_PATHS[this.playerIndex];
    const distanceFromBase = fullPath.indexOf(this.position) - 1;
    return distanceFromBase + (this.bonus ?? 0);
  }

  public getNextPosition(dice: number): Position {
    if (this.position === Position.home) {
      throw new BadRequestException(`Already in Home`);
    }
    const fullPath = PAWN_PATHS[this.playerIndex] as Position[];
    if (LudoMegaTournamentGameTable.isBasePosition(this.position)) {
      // If the pawn is in base, only 1 or 6 can actually move the pawn
      if (dice !== 1 && dice !== 6) {
        throw new BadRequestException(
          `1 or 6 needed to move pawn out from the base, but got ${dice}`,
        );
      }
      // the pawn is placed on the first cell
      return fullPath[1];
    }
    const remainingStepsOnHomePath =
      LudoMegaTournamentGameTable.getRemainingStepsOnHomePath(this.position);
    if (remainingStepsOnHomePath > 0 && remainingStepsOnHomePath < dice) {
      // If pawn is on home path and the remaining step is less than the dice, it can not move
      throw new BadRequestException(
        `${remainingStepsOnHomePath} steps to Home, but got ${dice}`,
      );
    }

    const cellIndex = fullPath.indexOf(this.position);

    return fullPath[cellIndex + dice];
  }

  public getBasePosition(): Position {
    const fullPath = PAWN_PATHS[this.playerIndex] as Position[];
    return fullPath[1];
  }

  public getRandomPosition(excludePositions: Position[]): Position {
    const fullPath = PAWN_PATHS[this.playerIndex] as Position[];
    // exclude base position (first position in the path) and home path (last 6 positions in the path)
    const mainPath = fullPath.slice(1, -6);
    while (true) {
      const randomIndex = getRandomInteger(0, mainPath.length - 1);
      const randomPosition = mainPath[randomIndex];
      if (!excludePositions.includes(randomPosition)) {
        return randomPosition;
      }
    }
  }

  public moveTo(position: Position) {
    this.position = position;
  }

  public creditBonus(bonus: number) {
    this.bonus = (this.bonus ?? 0) + bonus;
  }
}
