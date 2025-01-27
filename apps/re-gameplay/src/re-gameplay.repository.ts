import {
  SpTableHistoryDto,
  SpRoundHistoryDto,
  SPRoundHistoryParameters,
} from '@lib/fabzen-common/types';
import { ReRoundHistoryResponseDto } from 'apps/rest-api/src/subroutes/history/history.dto';
import { ReRoundHistoryDto, ReTableHistoryDto } from './re-gameplay.types';

export abstract class ReGameHistoryRepository {
  abstract createTableHistory(
    newTableHistory: SpTableHistoryDto,
  ): Promise<void>;
  abstract createRoundHistory(
    newRoundHistory: SpRoundHistoryDto,
  ): Promise<void>;
  abstract createReTableHistory(
    newTableHistory: ReTableHistoryDto,
  ): Promise<void>;
  abstract createReRoundHistory(
    newRoundHistory: ReRoundHistoryDto,
  ): Promise<void>;
  abstract getRoundHistory(
    historyParameters: SPRoundHistoryParameters,
  ): Promise<ReRoundHistoryResponseDto>;
}

export const createMockWalletRepository = (): ReGameHistoryRepository => ({
  createTableHistory: jest.fn(),
  createRoundHistory: jest.fn(),
  createReTableHistory: jest.fn(),
  createReRoundHistory: jest.fn(),
  getRoundHistory: jest.fn(),
});
