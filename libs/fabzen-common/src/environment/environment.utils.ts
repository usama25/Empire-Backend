/* istanbul ignore file */

import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';
import { InternalServerErrorException } from '@nestjs/common';

import { EnvironmentVariables } from './environment-spec';

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });
  if (errors.length > 0) {
    const formattedErrorMessage = formatValidationErrorMessage(errors);
    console.error(formattedErrorMessage);
    throw new InternalServerErrorException(formatValidationErrorMessage);
  }
  return validatedConfig;
}

export function formatValidationErrorMessage(
  errors: ValidationError[],
): string {
  const errorMessages = [];
  for (const error of errors) {
    const { constraints, children } = error;
    if (constraints) {
      for (const errorMessage of Object.values(constraints)) {
        errorMessages.push(errorMessage);
      }
    } else if (children) {
      // Nested Schema
      processNestedErrors(children, errorMessages);
    }
  }
  return errorMessages.join('\n');
}

function processNestedErrors(
  errors: ValidationError[],
  errorMessages: string[],
) {
  for (const error of errors) {
    const { constraints, children } = error;
    if (constraints) {
      for (const errorMessage of Object.values(constraints)) {
        errorMessages.push(errorMessage);
      }
    } else if (children) {
      processNestedErrors(children, errorMessages);
    }
  }
}
