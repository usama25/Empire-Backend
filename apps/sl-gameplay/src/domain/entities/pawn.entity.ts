import { BadRequestException } from '@nestjs/common';
import { PawnId, PawnPosition, Position, SLGameBoard } from './types';

export class Pawn {
  constructor(
    public playerIndex: number,
    public pawnIndex: number,
    public position: Position,
  ) {}

  public static fromPawnPosition({ pawn, position }: PawnPosition): Pawn {
    const [playerIndex, pawnIndex] = pawn
      .replace('PW', '')
      .split('-')
      .map((index) => Number.parseInt(index, 10) - 1);
    return new Pawn(playerIndex, pawnIndex, position);
  }

  public getPawnId(): PawnId {
    return `PW${this.playerIndex + 1}-${this.pawnIndex + 1}` as PawnId;
  }

  public toPawnPosition(): PawnPosition {
    return {
      pawn: this.getPawnId(),
      position: this.position,
      points: this.calculatePoints(),
    };
  }

  public calculatePoints(): number {
    switch (this.position) {
      case Position.home: {
        return 100;
      }
      case Position.base: {
        return 0;
      }
      default: {
        return Number.parseInt(this.position, 10);
      }
    }
  }

  public getNextPosition(dice: number, slGameBoard: SLGameBoard) {
    if (this.position === Position.home) {
      throw new BadRequestException('Already in Home');
    }

    const positionIndex = Object.values(Position).indexOf(this.position);
    const nextIndex = positionIndex + dice > 100 ? 100 : positionIndex + dice;

    const { nextPos, isLadder, isSnake } = this.getNewPositionIfLadderOrSnake(
      nextIndex,
      slGameBoard,
    );
    const nextPosition = this.#getPositionByIndex(nextPos);
    return { nextPosition, nextIndex, isSnake, isLadder };
  }

  #getPositionByIndex(index: number): Position {
    const values = Object.values(Position) as string[];
    return index >= 0 && index < values.length
      ? (values[index] as Position)
      : Position.base;
  }

  public moveTo(position: Position) {
    this.position = position;
  }

  public getNewPositionIfLadderOrSnake(
    index: number,
    slGameBoard: SLGameBoard,
  ) {
    const SNAKES_POSITION = Object.values(slGameBoard)[0];
    const LADDERS_POSITION = Object.values(slGameBoard)[1];
    let isSnake: boolean = false;
    let isLadder: boolean = false;
    let nextPos: number = index;
    // Check if the index matches the start of any ladder
    for (const [start, end] of LADDERS_POSITION) {
      if (start === index) {
        nextPos = end; // Return the end of the ladder
        isLadder = true;
      }
    }

    // Check if the index matches the start of any snake
    for (const [start, end] of SNAKES_POSITION) {
      if (start === index) {
        nextPos = end; // Return the end of the snake
        isSnake = true;
      }
    }

    // If no ladder or snake is found, return the original index
    return { nextPos, isSnake, isLadder };
  }
}
