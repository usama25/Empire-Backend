import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';

import { App } from '@lib/fabzen-common/types';
import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { getServicesInfoToConnect } from '@lib/fabzen-common/configuration';
import { GameRecordTransporterController } from './transporter.controller';
import { GameRecordUseCases } from './use-cases';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

@Module({})
export class GameRecordModule {
  static forRoot(mongoUri: string): DynamicModule {
    const clients = getServicesInfoToConnect(App.gameRecord);
    return {
      module: GameRecordModule,
      imports: [
        EnvironmentModule,
        MongooseModule.forRoot(mongoUri),
        ClientsModule.register({
          clients,
          isGlobal: true,
        }),
      ],
      controllers: [GameRecordTransporterController],
      providers: [GameRecordUseCases],
    };
  }
}
