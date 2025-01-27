import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public, HealthCheck } from '../decorators';

@Public()
@Controller()
export class FbzBaseHttpController {
  @HealthCheck()
  @Get()
  @ApiTags('Health Check')
  @ApiOperation({ summary: 'Health Check' })
  @ApiResponse({
    status: 200,
    description: 'Healthy',
  })
  getStatus() {
    return { status: 'OK' };
  }
}
