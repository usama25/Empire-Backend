import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AviatorHistoryRepository } from 'apps/aviator-gameplay/src/domain/interfaces';

@ApiBearerAuth()
@ApiTags('Aviator')
@Controller()
export class AviatorController {
  constructor(
    private readonly aviatorHistoryRepository: AviatorHistoryRepository,
  ) {}

  @Get('/history/round')
  @ApiOperation({ summary: 'Get Round History' })
  async getRoundHistory(
    @Query('skip') skip: number,
    @Query('limit') limit: number,
  ) {
    return await this.aviatorHistoryRepository.getRoundHistory(skip, limit);
  }
}
