import { File } from '@lib/fabzen-common/types';

import {
  PanUploadResponse,
  GenerateOtpResponse,
  SubmitOtpResponse,
} from '../../infrastructure/gateways';

export abstract class SurepassGateway {
  abstract uploadKyc(files: File[]): Promise<PanUploadResponse>;
  abstract generateOtp(aadhaarId: string): Promise<GenerateOtpResponse>;
  abstract submitOtp(clientId: string, otp: string): Promise<SubmitOtpResponse>;
}

export const createMockSurepassGateway = (): SurepassGateway => ({
  uploadKyc: jest.fn(),
  generateOtp: jest.fn(),
  submitOtp: jest.fn(),
});
