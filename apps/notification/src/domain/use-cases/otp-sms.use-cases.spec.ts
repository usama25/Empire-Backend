import { testMobileNumber, testOtp } from '@lib/fabzen-common/jest/stubs';

import { createMockOtpSmsService } from '../interfaces';
import { OtpSmsUseCases } from './otp-sms.use-cases';

jest.useFakeTimers();

describe('Otp Sms Use Cases', () => {
  const mockOtpSmsService = createMockOtpSmsService();
  const otpUseCases: OtpSmsUseCases = new OtpSmsUseCases(mockOtpSmsService);

  describe('Send OTP', () => {
    describe('Success', () => {
      it('First Attemp', async () => {
        (mockOtpSmsService.sendOtp as jest.Mock).mockReturnValue(
          // eslint-disable-next-line unicorn/no-useless-undefined
          undefined,
        );
        expect(
          otpUseCases.sendOtp(testMobileNumber, testOtp, true, true),
        ).resolves.toBeUndefined();
      });
    });
  });
});
