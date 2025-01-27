import { FileValidator } from '@nestjs/common';

export class FileTypeValidator extends FileValidator {
  buildErrorMessage(): string {
    return 'Only Accept JPEG or PNG files';
  }

  isValid(file: Express.Multer.File): boolean {
    const buffer = file.buffer;
    return (
      this.#checkIfJpegFileFromMagicNumber(buffer) ||
      this.#checkIfPngFileFromMagicNumber(buffer)
    );
  }

  #checkIfJpegFileFromMagicNumber(buffer: Buffer) {
    const JPEG_MAGIC_NUMBER = Buffer.from([0xff, 0xd8]);
    return buffer
      .subarray(0, JPEG_MAGIC_NUMBER.length)
      .equals(JPEG_MAGIC_NUMBER);
  }

  #checkIfPngFileFromMagicNumber(buffer: Buffer) {
    const PNG_MAGIC_NUMBER = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    return buffer.subarray(0, PNG_MAGIC_NUMBER.length).equals(PNG_MAGIC_NUMBER);
  }
}
