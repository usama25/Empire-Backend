import { SetMetadata } from '@nestjs/common';

export const IS_HEALTH_CHECK_KEY = 'isHealthCheck';
export const HealthCheck = () => SetMetadata(IS_HEALTH_CHECK_KEY, true);
