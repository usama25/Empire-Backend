import { Queue } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class BullScheduleService {
  private readonly logger = new Logger(BullScheduleService.name);

  constructor(
    @InjectQueue('epl')
    private queue: Queue,
  ) {}
}
