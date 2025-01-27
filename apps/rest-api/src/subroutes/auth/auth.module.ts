import { Module } from '@nestjs/common';

import { AuthHttpController } from './auth.controller';

@Module({
  controllers: [AuthHttpController],
})
export class AuthModule {}
