import { Module } from '@nestjs/common';
import { LudoTournamentModule } from './tournament/tournament.module';
import { LudoMegaTournamentModule } from './mega-tournament/mega-tournament.module';

@Module({
  imports: [LudoTournamentModule, LudoMegaTournamentModule],
  controllers: [],
})
export class LudoModule {}
