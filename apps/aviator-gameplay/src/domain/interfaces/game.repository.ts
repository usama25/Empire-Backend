import { RoundInfo } from '../use-cases';

export abstract class AviatorRoundRepository {
  abstract getCurrentRoundInfo(): Promise<RoundInfo>;
  abstract setCurrentRoundInfo(roundInfo: RoundInfo): Promise<void>;
  abstract initializeRound(roundNo: number): Promise<void>;
  abstract playerBet(
    roundNo: number,
    userId: string,
    amount: string,
  ): Promise<void>;
  abstract getBetInfo(
    roundNo: number,
    userId: string,
  ): Promise<string | undefined>;
  abstract getBetUsers(roundNo: number): Promise<string[]>;
  abstract getServerSeed(): Promise<string | undefined>;
  abstract setServerSeed(serverSeed: string): Promise<void>;
  abstract getPlayerSeed(playerKey: string): Promise<string | undefined>;
  abstract setPlayerSeed(playerKey: string, seed: string): Promise<void>;
  abstract getCrashValue(): Promise<number | undefined>;
  abstract setCrashValue(value: number): Promise<void>;

  abstract getRoundlock(): Promise<boolean>;
  abstract setRoundlock(lock: boolean): Promise<void>;
}
