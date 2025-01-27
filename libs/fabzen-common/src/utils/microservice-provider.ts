/* istanbul ignore file */

import { catchError, firstValueFrom, defaultIfEmpty } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';

import { TransporterCmds, TransporterAttachment } from '../types';
import { FbzLogger } from './logger.util';
import { S3Util } from './s3.util';
import { config } from '../configuration';

export class MicroserviceProvider {
  protected readonly client: ClientProxy;
  private readonly logger: FbzLogger = new FbzLogger(MicroserviceProvider.name);
  constructor(client: ClientProxy) {
    this.client = client;
  }

  async _sendRequest<T>(
    cmd: TransporterCmds,
    body: Record<string, any>,
    files?: Express.Multer.File[],
  ): Promise<T> {
    const attachments = await this.#getAttacthments(files);
    return await this.#doSendRequest<T>(cmd, body, attachments);
  }

  async #doSendRequest<T>(
    cmd: TransporterCmds,
    body: Record<string, any>,
    attachments: TransporterAttachment[] | undefined,
  ): Promise<T> {
    const observable = this.client.send<T>(cmd, { body, attachments });
    return await firstValueFrom(
      observable.pipe(
        defaultIfEmpty({} as T),
        catchError((error) => {
          if (error.message === 'Connection closed') {
            return this.#doSendRequest<T>(cmd, body, attachments);
          }
          throw error;
        }),
      ),
    );
  }

  async _sendEvent(
    cmd: TransporterCmds,
    body: Record<string, any>,
    files?: Express.Multer.File[],
  ): Promise<void> {
    const attachments = await this.#getAttacthments(files);
    this.#doSendEvent(cmd, body, attachments);
  }

  async #doSendEvent(
    cmd: TransporterCmds,
    body: Record<string, any>,
    attachments: TransporterAttachment[] | undefined,
  ): Promise<void> {
    this.client.emit(cmd, { body, attachments });
  }

  async #getAttacthments(
    files?: Express.Multer.File[],
  ): Promise<TransporterAttachment[] | undefined> {
    let attachments: TransporterAttachment[] | undefined;
    if (files) {
      attachments = await this.#uploadAndGetKeys(files);
    }
    return attachments;
  }

  async #uploadAndGetKeys(
    files: Express.Multer.File[],
  ): Promise<TransporterAttachment[]> {
    const attachments: TransporterAttachment[] = [];

    const s3Util = new S3Util();

    for await (const file of files) {
      const sanitizedFilename = file.originalname.replace(
        config.aws.s3.s3KeyInvalidChars,
        '',
      );
      const uploadResponse = await s3Util.upload({
        Bucket: config.aws.s3.transporterS3Bucket,
        Key: sanitizedFilename,
        ContentType: file.mimetype,
        Body: file.buffer,
      });
      if (uploadResponse?.Key) {
        attachments.push({
          filename: file.originalname,
          fieldName: file.fieldname,
          contentType: file.mimetype,
          s3Key: uploadResponse.Key,
        });
      }
    }
    return attachments;
  }
}
