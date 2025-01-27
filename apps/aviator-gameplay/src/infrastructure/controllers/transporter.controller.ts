import { Controller, UseInterceptors } from '@nestjs/common';

import { TransporterExceptionInterceptor } from '@lib/fabzen-common/interceptors';

import { AviatorGameplayUseCases } from '../../domain/use-cases';
import { TransporterCmds } from '@lib/fabzen-common/types';
import { MessagePattern } from '@nestjs/microservices';
import { MessageData } from '@lib/fabzen-common/decorators';

@Controller()
@UseInterceptors(new TransporterExceptionInterceptor())
export class AviatorGameplayTrasporterController {
  constructor(private readonly aviatorUseCases: AviatorGameplayUseCases) {}

  @MessagePattern(TransporterCmds.AVIATOR_CHECK_IF_RECONNECTED)
  async checkIfReconnected(
    @MessageData()
    { userId }: { userId: string },
  ): Promise<boolean> {
    return await this.aviatorUseCases.checkIfReconnected(userId);
  }
}
