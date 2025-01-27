/* istanbul ignore file */

import {
  applyDecorators,
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  Type,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { SubscribeMessage } from '@nestjs/websockets';

import { WsExceptionsFilter } from '../exception-filters';
import { WsInterceptor } from '../interceptors';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { formatValidationErrorMessage } from '../environment/environment.utils';

export function WsSubscribeMessage(event: string) {
  return applyDecorators(
    SetMetadata('eventName', event),
    UseInterceptors(WsInterceptor),
    UseFilters(WsExceptionsFilter),
    SubscribeMessage(event),
  );
}

export const WsUserID = createParamDecorator(
  (_: unknown, context: ExecutionContext) => {
    const client = context.switchToWs().getClient();
    return client.user?.userId;
  },
);

export const WsClient = createParamDecorator(
  (_: unknown, context: ExecutionContext) => {
    const client = context.switchToWs().getClient();
    return client;
  },
);

export const WsData = createParamDecorator(
  (dto: Type, context: ExecutionContext) => {
    let wsData = context.switchToWs().getData();
    if (typeof wsData === 'string') {
      try {
        wsData = JSON.parse(wsData);
      } catch {
        throw new BadRequestException(`Malformed Input Data: ${wsData}`);
      }
    }
    const object = plainToInstance(dto, wsData, {
      excludeExtraneousValues: true,
    });
    return validate(object).then((errors) => {
      if (errors.length > 0) {
        // Throw an error if validation fails
        const formattedErrorMessage = formatValidationErrorMessage(errors);
        throw new BadRequestException(formattedErrorMessage);
      } else {
        // Return the response data if validation passes
        return object;
      }
    });
  },
);
