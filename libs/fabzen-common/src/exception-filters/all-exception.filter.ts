import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  logger: Logger;
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {
    this.logger = new Logger('HTTP Exception');
    process.on('uncaughtException', (...arguments_: any[]) => {
      this.logger.error(`HTTP exception ${JSON.stringify(arguments_)}`);
    });
  }

  catch(exception: any, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : (exception.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const responseBody: Record<string, unknown> =
      exception instanceof HttpException
        ? (exception.getResponse() as Record<string, unknown>)
        : {
            statusCode,
            message: exception.message ?? 'Internal server error',
          };
    httpAdapter.reply(context.getResponse(), responseBody, statusCode);
    const error = JSON.parse(JSON.stringify(exception));
    delete error.response;
    this.logger.error('Exception on request:', {
      responseBody,
    });
  }
}
