import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const UserID = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.user?.userId;
  },
);
