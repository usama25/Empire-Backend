import { applyDecorators, Type, UseInterceptors } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ValidationInterceptor } from '../interceptors/response-validation.interceptor';

export function ApiValidatedOkResponse(type: Type) {
  return applyDecorators(
    ApiOkResponse({ type }),
    UseInterceptors(new ValidationInterceptor(type)),
  );
}
