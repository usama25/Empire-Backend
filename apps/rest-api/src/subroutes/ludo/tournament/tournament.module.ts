import { Module } from '@nestjs/common';

import { LudoTournamentController } from './tournament.controller';

@Module({
  controllers: [LudoTournamentController],
})
export class LudoTournamentModule {}
