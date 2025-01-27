import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { TransporterProviders } from '@lib/fabzen-common/types';

import { UserRepository } from '../../domain/interfaces';
import { MicroserviceUserRepository } from './microservice-user.repository';

@Module({
  imports: [
    ClientsModule.register({
      clients: [
        {
          name: TransporterProviders.USER_SERVICE,
          transport: Transport.TCP,
          options: {
            host: 'user',
            port: 4022,
          },
        },
      ],
      isGlobal: true,
    }),
  ],
  providers: [
    {
      provide: UserRepository,
      useClass: MicroserviceUserRepository,
    },
  ],
  exports: [UserRepository],
})
export class RepositoriesModule {}
