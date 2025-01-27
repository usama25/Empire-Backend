import { MobileNumber } from '@lib/fabzen-common/types';

export abstract class OtpSmsService {
  abstract sendOtp(
    mobileNumber: MobileNumber,
    otp: string,
    isPlayStoreBuild: boolean,
    isGlobalBuild: boolean,
  ): Promise<void>;

  abstract sendDownloadLinkSms(mobileNumber: MobileNumber): Promise<void>;
}

export const createMockOtpSmsService = (): OtpSmsService => ({
  sendOtp: jest.fn(),
  sendDownloadLinkSms: jest.fn(),
});
