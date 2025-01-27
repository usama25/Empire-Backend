import {
  SpTableHistoryDto,
  SpRoundHistoryDto,
  SPRoundHistoryParameters,
} from '@lib/fabzen-common/types';
import { SpRoundHistoryResponseDto } from 'apps/rest-api/src/subroutes/history/history.dto';

export abstract class SpGameHistoryRepository {
  abstract createTableHistory(
    newTableHistory: SpTableHistoryDto,
  ): Promise<void>;
  abstract createRoundHistory(
    newRoundHistory: SpRoundHistoryDto,
  ): Promise<void>;
  abstract getRoundHistory(
    historyParameters: SPRoundHistoryParameters,
  ): Promise<SpRoundHistoryResponseDto>;
}

export const createMockWalletRepository = (): SpGameHistoryRepository => ({
  createTableHistory: jest.fn(),
  createRoundHistory: jest.fn(),
  getRoundHistory: jest.fn(),
});
