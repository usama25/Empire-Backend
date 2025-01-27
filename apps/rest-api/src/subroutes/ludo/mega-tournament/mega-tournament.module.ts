import { Module } from '@nestjs/common';

import { LudoMegaTournamentController } from './mega-tournament.controller';

@Module({
  controllers: [LudoMegaTournamentController],
})
export class LudoMegaTournamentModule {}
