/* istanbul ignore file */

import { ConsoleLogger } from '@nestjs/common';

import { Environment } from '../types';

export class FbzLogger extends ConsoleLogger {
  log(...message: any[]) {
    console.log(...message);
  }

  fatal(...message: any[]) {
    if (process.env.NENV !== Environment.jest) {
      console.log('Fatal Error!');
      console.error(...message);
    }
  }

  error(...message: any[]) {
    if (process.env.NENV !== Environment.jest) {
      console.error(...message);
    }
  }

  warn(...message: any[]) {
    console.warn(...message);
  }

  debug(...message: any[]) {
    console.debug(...message);
  }

  verbose(...message: any[]) {
    console.debug(...message);
  }
}
