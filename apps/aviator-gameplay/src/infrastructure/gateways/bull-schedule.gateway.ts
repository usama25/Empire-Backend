import { Queue } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';

import { ScheduleService } from '../../domain/interfaces';

@Injectable()
export class BullScheduleService implements ScheduleService {
  private readonly logger = new Logger(BullScheduleService.name);

  constructor(
    @InjectQueue('aviator')
    private queue: Queue,
  ) {}
}
