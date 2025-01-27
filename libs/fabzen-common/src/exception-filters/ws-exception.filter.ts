/* istanbul ignore file */

import { Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';

@Catch()
export class WsExceptionsFilter extends BaseWsExceptionFilter {
  logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('WS Exception');
    process.on('uncaughtException', (...arguments_: any[]) => {
      this.logger.error(`Uncaught exception ${JSON.stringify(arguments_)}`);
    });
  }

  catch(exception: any, host: ArgumentsHost) {
    const errorObject = this.#getErrorObject(exception);
    if (!errorObject) {
      console.error(exception);
    }
    const code = errorObject?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;

    if (code >= 500) {
      console.error('WS Exception');
      console.error(errorObject);
    }

    const message = errorObject?.message ?? exception.message;

    const client = host.switchToWs().getClient();

    client.emit('exception', {
      code,
      message,
      cause: exception.eventName ?? 'joinTable',
    });
  }

  #getErrorObject(exception: any) {
    if (exception.statusCode && exception.message) {
      return exception;
    }
    return exception.error ?? exception.response;
  }
}
