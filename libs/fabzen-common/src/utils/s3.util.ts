/* istanbul ignore file */

import { readFileSync } from 'node:fs';
import {
  CompleteMultipartUploadCommandOutput,
  CreateBucketCommand,
  CreateBucketCommandOutput,
  DeleteObjectCommand,
  DeleteObjectCommandOutput,
  GetObjectCommand,
  S3,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Progress, Upload } from '@aws-sdk/lib-storage';
import { InternalServerErrorException } from '@nestjs/common';

import { FbzLogger } from './logger.util';
import {
  UploadParameters,
  S3FileUploadResponse,
  File,
  Environment,
} from '../types';
import { config } from '../configuration/configuration';
import { getRandomString } from './random.utils';

export class S3Util {
  bucketPrefix: string;
  logger: FbzLogger = new FbzLogger(S3Util.name);
  s3Client: S3;

  constructor() {
    const {
      accessKeyId,
      secretAccessKey,
      region,
      s3: { s3BucketPrefix },
      localstackEndpoints: { s3: localstackS3Endpoint },
    } = config.aws;
    const s3Config: S3ClientConfig = {
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      region,
    };
    if ([Environment.development, Environment.jest].includes(config.env)) {
      s3Config.endpoint = localstackS3Endpoint;
      s3Config.forcePathStyle = true;
    }
    this.s3Client = new S3(s3Config);
    this.bucketPrefix = s3BucketPrefix;
  }

  private async createBucket(
    bucketName: string,
  ): Promise<CreateBucketCommandOutput> {
    try {
      const createBucketCmd = new CreateBucketCommand({
        Bucket: this.#prefixBucket(bucketName),
      });
      const response = await this.s3Client.send(createBucketCmd);
      return response;
    } catch (error) {
      this.logger.error('S3 Util create bucket error', { error });
      throw error;
    }
  }

  async upload({
    Bucket,
    Key,
    ContentType,
    Body,
  }: UploadParameters): Promise<CompleteMultipartUploadCommandOutput> {
    if (config.isJest) {
      const mockS3Key = `${config.jest.testAssestsFolder}${Key}`;
      return {
        Key: mockS3Key,
        Location: mockS3Key,
      } as CompleteMultipartUploadCommandOutput;
    }
    try {
      const parameters = {
        Bucket: this.#prefixBucket(Bucket),
        Key: `${getRandomString(9)}-${Key}`,
        ContentType,
        Body,
      };
      const s3Upload = new Upload({
        client: this.s3Client,
        params: parameters,
      });

      s3Upload.on('httpUploadProgress', (progress: Progress) => {
        this.logger.debug('S3 upload httpUploadProgress', { Key, progress });
      });

      const result = await s3Upload.done();
      if (!result.Location) {
        // res: AbortMultipartUploadCommandOutput
        throw new InternalServerErrorException(
          'Wrong implementation or S3 error. Response must be CompleteMultipartUploadCommandOutput and contain Location.',
        );
      }

      return result;
    } catch (error) {
      if (/bucket does not exist/.test(error.message)) {
        this.logger.warn(`S3 Bucket doesn't exist.`, { error });
        await this.createBucket(Bucket);
        return this.upload({ Bucket, Key, ContentType, Body });
      }
      this.logger.error('S3 Util upload error', { error });
      throw error;
    }
  }

  async download(Bucket: string, Key: string): Promise<Buffer> {
    if (config.isJest) {
      return readFileSync(Key);
    }
    try {
      const getObjectCmd = new GetObjectCommand({
        Bucket: this.#prefixBucket(Bucket),
        Key,
      });
      const result = await this.s3Client.send(getObjectCmd);
      const uint8Array = await result.Body?.transformToByteArray();
      return Buffer.from(uint8Array ?? []);
    } catch (error) {
      this.logger.error('S3 Util download error', { error });
      throw error;
    }
  }

  async delete(
    Bucket: string,
    Key: string,
  ): Promise<DeleteObjectCommandOutput> {
    try {
      const deleteObjectCmd = new DeleteObjectCommand({
        Bucket: this.#prefixBucket(Bucket),
        Key,
      });
      const result = await this.s3Client.send(deleteObjectCmd);
      return result;
    } catch (error) {
      this.logger.error('S3 Util delete error', { error });
      throw error;
    }
  }

  async uploadFiles(
    files: File[],
    bucket: string,
  ): Promise<S3FileUploadResponse[]> {
    const fileLocations: S3FileUploadResponse[] = [];
    for await (const file of files) {
      const uploadResult = await this.upload({
        Bucket: bucket,
        Key: file.filename,
        ContentType: file.contentType,
        Body: file.data,
      });
      if (!uploadResult.Location) {
        throw new InternalServerErrorException(
          `S3 upload didn't provide Location URL.`,
        );
      }
      fileLocations.push({
        fieldName: file.fieldName,
        url: uploadResult.Location,
      });
    }
    return fileLocations;
  }

  #prefixBucket(originalBucket: string): string {
    return `${this.bucketPrefix}-${originalBucket}`;
  }
}
