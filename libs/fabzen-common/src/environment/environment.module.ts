import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validate } from './environment.utils';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      cache: true,
    }),
  ],
})
export class EnvironmentModule {}
