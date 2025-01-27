import { EPLGameTable } from '../entities';
// import { HistoryParameters } from '@lib/fabzen-common/types';
// import { EPLGameHistoryResponseDto } from 'apps/rest-api/src/subroutes/history/history.dto';

export abstract class EPLGameMongooseRepository {
  abstract createEPLGameHistory(table: EPLGameTable): Promise<boolean>;

  // abstract getEPLGameHistory(
  //   historyParameters: HistoryParameters,
  // ): Promise<EPLGameHistoryResponseDto>;
}
