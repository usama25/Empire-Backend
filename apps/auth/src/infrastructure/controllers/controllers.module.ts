import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { config } from '@lib/fabzen-common/configuration';

import { AuthTransporterController } from './';
import { UsecasesModule } from '../../domain/use-cases';

@Module({})
export class AuthControllersModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: AuthControllersModule,
      imports: [
        UsecasesModule.forRoot(mongoUri),
        JwtModule.register({
          privateKey: config.auth.jwt.privateKey,
          signOptions: {
            algorithm: config.auth.jwt.algorithm,
            expiresIn: config.auth.jwt.expiration,
          },
        }),
      ],
      controllers: [AuthTransporterController],
    };
  }
}
