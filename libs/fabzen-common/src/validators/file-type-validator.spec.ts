import * as fs from 'node:fs';

import { FileTypeValidator } from './file-type-validator';

describe('File Type Validator', () => {
  const fileTypeValidator: FileTypeValidator = new FileTypeValidator({});

  it('should return the correct error message', () => {
    expect(fileTypeValidator.buildErrorMessage()).toBe(
      'Only Accept JPEG or PNG files',
    );
  });

  it('should return true for valid files', async () => {
    const jpegFile = fs.readFileSync('./assets/test-files/test.jpg');
    const pngFile = fs.readFileSync('./assets/test-files/test.png');
    expect(
      fileTypeValidator.isValid({ buffer: jpegFile } as Express.Multer.File),
    ).toBe(true);
    expect(
      fileTypeValidator.isValid({ buffer: pngFile } as Express.Multer.File),
    ).toBe(true);
  });

  it('should return false for invalid files', async () => {
    const txtFile = fs.readFileSync('./assets/test-files/test.txt');
    expect(
      fileTypeValidator.isValid({ buffer: txtFile } as Express.Multer.File),
    ).toBe(false);
  });
});
