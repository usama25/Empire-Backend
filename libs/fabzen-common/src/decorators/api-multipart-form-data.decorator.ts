/* istanbul ignore file */

import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

import { FormDataField } from '../types';

export function ApiMultipartFormData(formFields: FormDataField[]) {
  const schemaProperties: Record<string, any> = {};
  const requiredFields: string[] = [];
  const decorators: MethodDecorator[] = [];

  for (const { name, type, required } of formFields) {
    if (required) {
      requiredFields.push(name);
    }
    if (type === 'files') {
      schemaProperties[name] = {
        type: 'array',
        items: { type: 'string', format: 'binary' },
      };
      // decorators.push(UseInterceptors(FilesInterceptor(name)));
    } else if (type === 'file') {
      schemaProperties[name] = {
        type: 'string',
        format: 'binary',
      };
      // decorators.push(UseInterceptors(FileInterceptor(name)));
    } else {
      schemaProperties[name] = {
        type,
      };
    }
  }

  decorators.unshift(
    ApiBody({
      required: true,
      type: 'multipart/form-data',
      schema: {
        type: 'object',
        properties: schemaProperties,
        required: requiredFields,
      },
    }),
    ApiConsumes('multipart/form-data'),
  );

  return applyDecorators(...decorators);
}
