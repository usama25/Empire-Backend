/* istanbul ignore file */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  InternalServerErrorException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { formatValidationErrorMessage } from '@lib/fabzen-common/environment/environment.utils';

@Injectable()
export class ValidationInterceptor implements NestInterceptor {
  constructor(private readonly responseClass: any) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Transform the response data to the response class
        const object = plainToInstance(this.responseClass, data, {
          excludeExtraneousValues: true,
        });
        // Validate the response class
        return validate(object).then((errors) => {
          if (errors.length > 0) {
            // Throw an error if validation fails
            const formattedErrorMessage = formatValidationErrorMessage(errors);
            throw new InternalServerErrorException(formattedErrorMessage);
          } else {
            // Return the response data if validation passes
            return object;
          }
        });
      }),
      catchError((error) => {
        throw error;
      }),
    );
  }
}
