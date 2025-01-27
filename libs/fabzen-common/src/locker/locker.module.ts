import { DynamicModule, Module } from '@nestjs/common';
import { RedisModule } from '../redis/module';
import { RedisConnectionOptions } from '../redis/types';
import { LockerService } from './locker.service';

@Module({})
export class LockerModule {
  static forRoot(redisConnectionOption: RedisConnectionOptions): DynamicModule {
    return {
      module: LockerModule,
      imports: [RedisModule.forRoot(redisConnectionOption)],
      providers: [LockerService],
      exports: [LockerService],
    };
  }
}
