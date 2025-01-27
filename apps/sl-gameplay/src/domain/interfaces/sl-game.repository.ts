import { SLGameTable } from '../entities';
import { HistoryParameters } from '@lib/fabzen-common/types';
import {
  SLRoundHistoryResponseDto,
  SLGameHistoryResponseDto,
} from 'apps/rest-api/src/subroutes/history/history.dto';

export abstract class SLGameMongooseRepository {
  abstract createSLGameHistory(
    table: SLGameTable,
    userId?: string,
  ): Promise<boolean>;

  abstract getSLGameHistory(
    historyParameters: HistoryParameters,
  ): Promise<SLGameHistoryResponseDto>;

  abstract getRoundHistory(
    historyParameters: HistoryParameters,
  ): Promise<SLRoundHistoryResponseDto>;
}
