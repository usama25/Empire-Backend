import { HistoryParameters } from '@lib/fabzen-common/types';
import {
  AviatorNewRoundHistoryDto,
  AviatorRoundHistoryResponseDto,
  AviatorUserResponseDto,
  AviatorUserHistoryDto,
  AviatorUsersBetHistoryDto,
} from '../use-cases';

export abstract class AviatorHistoryRepository {
  abstract createRoundHistory(
    newRoundHistory: AviatorNewRoundHistoryDto,
  ): Promise<void>;
  abstract createUserHistory(
    newUserHistory: AviatorUserHistoryDto,
  ): Promise<void>;

  abstract updateRoundHistory(
    roundNo: number,
    crashValue: number,
    serverSeed: string,
  ): Promise<void>;
  abstract updateUserHistory(
    userId: string,
    roundNo: number,
    cashoutAmount: number,
    betAmount: number,
  ): Promise<void>;

  abstract getUserHistory(
    historyParameters: HistoryParameters,
  ): Promise<AviatorUserResponseDto>;
  abstract getRoundHistory(
    skip: number,
    limit: number,
  ): Promise<AviatorRoundHistoryResponseDto>;
  abstract getCurrentRoundPlayers(
    roundNo: number,
  ): Promise<AviatorUsersBetHistoryDto[]>;
}
