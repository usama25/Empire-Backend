import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { catchError } from 'rxjs';

export class TransporterExceptionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): any {
    return next.handle().pipe(
      catchError((error) => {
        throw new RpcException(error.response ?? error);
      }),
    );
  }
}
