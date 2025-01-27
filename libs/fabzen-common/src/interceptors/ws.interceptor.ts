import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { tap } from 'rxjs';

@Injectable()
export class WsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): any {
    return next.handle().pipe(
      tap({
        error: (error) => {
          error.eventName = Reflect.getMetadata(
            'eventName',
            (context.switchToWs() as any).handler,
          );
        },
      }),
    );
  }
}
