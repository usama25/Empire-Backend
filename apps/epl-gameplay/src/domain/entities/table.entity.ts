import * as dayjs from 'dayjs';
import {
  getRandomString,
  shuffleArray,
} from '@lib/fabzen-common/utils/random.utils';
import {
  EPLGameAction,
  PlayerId,
  EPLPlayerRole,
  UserEPLGameInfo,
} from './types';
import { UserGameDetails } from '@lib/fabzen-common/types';
import { TURN_TIMEOUT_IN_SECONDS, TABLE_ID_LENGTH } from './constants';
import {
  compressString,
  decompressString,
} from '@lib/fabzen-common/utils/string.utils';
import { GameStatus, TurnTimeoutEvent } from '../use-cases/types';

export class EPLGameTable {
  public id: string;
  public users: UserEPLGameInfo[];
  public score: number;
  // public innings: string;
  public innings: number;
  public currentBall: number;
  public action: EPLGameAction;
  public status: GameStatus;
  public timeout: string;
  public amount: string;
  public winAmount: string;
  public counter: number;
  public turnNo: number;
  public targetScore: string;
  public isOut: boolean;
  public startedAt: Date;
  public updatedAt: Date;
  public batBowlAction: boolean;
  players: any;

  constructor({
    users,
    id,
    score,
    innings,
    currentBall,
    action,
    status,
    amount,
    winAmount,
    turnNo,
    targetScore,
    isOut,
    batBowlAction,
  }: {
    users: UserEPLGameInfo[];
    id?: string;
    score?: number;
    // innings?: string;
    innings?: number;
    currentBall?: number;
    action?: EPLGameAction;
    status?: GameStatus;
    amount?: string;
    winAmount?: string;
    startedAt: Date;
    updatedAt: Date;
    turnNo?: number;
    targetScore?: string;
    isOut?: boolean;
    batBowlAction?: boolean;
  }) {
    this.id = id ?? this.#generateTableId();
    this.users = users;
    // this.innings = innings ?? '1';
    this.innings = innings ?? 1;
    this.currentBall = currentBall ?? 1;
    this.action = action ?? EPLGameAction.bat;
    this.status = status ?? GameStatus.waiting;
    this.amount = amount ?? '0';
    this.winAmount = winAmount ?? '0';
    this.score = score ?? 0;
    this.turnNo = turnNo ?? 0;
    this.targetScore = targetScore ?? '';
    this.isOut = isOut ?? false;
    this.batBowlAction = batBowlAction ?? false;
  }

  #generateTableId(): string {
    return getRandomString(TABLE_ID_LENGTH);
  }

  public static create(
    userDetails: UserGameDetails[],
    amount: string,
    winAmount: string | undefined,
    status: GameStatus,
  ): EPLGameTable {
    const roles = shuffleArray([EPLPlayerRole.batsman, EPLPlayerRole.bowler]);
    const users: UserEPLGameInfo[] = userDetails.map((user, index) => {
      const newUser: UserEPLGameInfo = {
        ...user,
        playerId: `PL${index + 1}` as PlayerId,
        role: roles[index],
        runs: 0,
        scores: [],
        score: '0',
        wickets: 0,
        didLeave: false,
      };

      return newUser;
    });

    return new EPLGameTable({
      users,
      amount,
      status,
      winAmount,
      startedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public generateTurnTimeout(): TurnTimeoutEvent[] {
    const turnTimeout = dayjs()
      .add(TURN_TIMEOUT_IN_SECONDS, 'seconds')
      .toISOString();

    const turnTimeoutResponse = this.users.map((user) => ({
      tableId: this.id,
      userId: user.userId,
      playerRole: user.role,
      timeout: turnTimeout,
    }));

    return turnTimeoutResponse;
  }

  public serialize(): string {
    const stringifiedTable = JSON.stringify(this);
    return compressString(stringifiedTable);
  }

  public static deserialize(serializedTable: string): EPLGameTable {
    const stringifiedTable = decompressString(serializedTable);
    const table = JSON.parse(stringifiedTable);
    return new EPLGameTable(table);
  }

  public incrementBallAndTimeout() {
    this.currentBall++;
    this.timeout = this.#getActionTimeout();
  }

  #getActionTimeout(): string {
    return dayjs().add(TURN_TIMEOUT_IN_SECONDS, 'seconds').toISOString();
  }
}
