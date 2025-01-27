import { DynamicModule, Module } from '@nestjs/common';

import { AviatorController } from './aviator.controller';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';

@Module({})
export class AviatorModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: AviatorModule,
      imports: [MongooseModule.forRoot(mongoUri)],
      controllers: [AviatorController],
    };
  }
}
