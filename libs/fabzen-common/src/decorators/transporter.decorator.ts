/* istanbul ignore file */

import { createParamDecorator, ExecutionContext, Type } from '@nestjs/common';

import { TransporterAttachment, File } from '../types';
import { S3Util } from '../utils/s3.util';
import { config } from '../configuration';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { formatValidationErrorMessage } from '../environment/environment.utils';
import { RpcException } from '@nestjs/microservices';

export const MessageData = createParamDecorator(
  (dto: Type, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const { body } = request;
    if (dto) {
      const object = plainToInstance(dto, body);
      return validate(object).then((errors) => {
        if (errors.length > 0) {
          // Throw an error if validation fails
          const formattedErrorMessage = formatValidationErrorMessage(errors);
          throw new RpcException(formattedErrorMessage);
        } else {
          // Return the response data if validation passes
          return body;
        }
      });
    } else {
      return body;
    }
  },
);

export const EventData = MessageData;

export const MessageAttachments = createParamDecorator(
  async (data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const s3Util = new S3Util();
    const attachments: TransporterAttachment[] = request.attachments;
    const files: File[] = [];
    for await (const attachment of attachments) {
      const data = await s3Util.download(
        config.aws.s3.transporterS3Bucket,
        attachment.s3Key,
      );

      files.push({
        filename: attachment.filename,
        fieldName: attachment.fieldName,
        contentType: attachment.contentType,
        size: data.length,
        data,
      } as File);
      if (!config.isJest) {
        await s3Util.delete(
          config.aws.s3.transporterS3Bucket,
          attachment.s3Key,
        );
      }
    }
    return files;
  },
);
