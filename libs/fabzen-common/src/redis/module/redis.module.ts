import { DynamicModule, Module } from '@nestjs/common';

import { RedisConnectionOptions } from '../types';
import { RedisService } from '.';

@Module({})
export class RedisModule {
  static forRoot(option: RedisConnectionOptions): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: RedisService,
          useFactory: () => {
            return new RedisService(option);
          },
        },
      ],
      exports: [RedisService],
    };
  }
}
