export type UploadParameters = {
  Bucket: string;
  Key: string;
  ContentType: string;
  Body: Buffer;
};

export type S3FileUploadResponse = {
  fieldName: string;
  url: string;
};

export type File = {
  filename: string;
  fieldName: string;
  contentType: string;
  data: Buffer;
  size: number;
};

export type TransporterAttachment = {
  filename: string;
  fieldName: string;
  contentType: string;
  s3Key: string;
};
