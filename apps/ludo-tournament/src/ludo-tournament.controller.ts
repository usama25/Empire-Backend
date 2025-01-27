import { Controller, UseInterceptors } from '@nestjs/common';

import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class LudoTournamentController {
  // @MessagePattern(TransporterCmds.INIT_AUTH)
  // async createTournament(
  //   @MessageData(CreateTournamentDto) createTournamentDto: CreateTournamentDto,
  // ) {}
}
