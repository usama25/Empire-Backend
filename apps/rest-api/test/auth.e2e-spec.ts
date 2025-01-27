/* eslint-disable unicorn/prevent-abbreviations */
import * as dayjs from 'dayjs';
import * as request from 'supertest';

import {
  testBuildInfo,
  testDevice,
  testMobileNumber,
  testOtp,
} from '@lib/fabzen-common/jest/stubs';
import { Role } from '@lib/fabzen-common/types';
import { HttpMethod, setupNock } from '@lib/fabzen-common/jest/setup-nock';
import { config } from '@lib/fabzen-common/configuration';

import { UserDocument } from '@lib/fabzen-common/mongoose/models';
import { BuildInfoDto } from '@lib/fabzen-common/dtos/user.common.dto';

jest.useFakeTimers({ legacyFakeTimers: true });

describe('Auth', () => {
  describe('Init Auth', () => {
    describe('Success', () => {
      beforeEach(() => {
        setupNock(config.auth.ipApiService.baseUrl, HttpMethod.get, {
          status: 'success',
          region: 'state',
        });
        setupNock(config.notification.msg91.baseUrl, HttpMethod.post);
      });
      it('Global Playstore Build', async () => {
        return request(server)
          .post('/auth/init')
          .send({
            mobileNo: testMobileNumber.number,
            build: testBuildInfo,
          })
          .expect(201);
      });
      it('Global Website Build', async () => {
        const build: BuildInfoDto = {
          ...testBuildInfo,
          isPlayStoreBuild: false,
        };
        return request(server)
          .post('/auth/init')
          .send({
            mobileNo: testMobileNumber.number,
            build,
          })
          .expect(201);
      });
      it('Local Playstore Build', async () => {
        const build: BuildInfoDto = {
          ...testBuildInfo,
          isGlobalBuild: false,
        };
        return request(server)
          .post('/auth/init')
          .send({
            mobileNo: testMobileNumber.number,
            build,
          })
          .expect(201);
      });
      it('Local Website Build', async () => {
        const build: BuildInfoDto = {
          ...testBuildInfo,
          isGlobalBuild: false,
          isPlayStoreBuild: false,
        };
        return request(server)
          .post('/auth/init')
          .send({
            mobileNo: testMobileNumber.number,
            build,
          })
          .expect(201);
      });
    });

    describe('Fail', () => {
      it('Ip Api returns fail', async () => {
        setupNock(config.auth.ipApiService.baseUrl, HttpMethod.get, {
          status: 'fail',
        });
        return request(server)
          .post('/auth/init')
          .send({
            mobileNo: testMobileNumber.number,
            build: testBuildInfo,
          })
          .expect(500);
      });
      describe('Ip Api returns success', () => {
        beforeEach(() => {
          setupNock(config.auth.ipApiService.baseUrl, HttpMethod.get, {
            status: 'success',
            region: 'state',
          });
        });
        it('Fail on too many attempts', async () => {
          await e2EServiceManager.authModel.create({
            _id: testMobileNumber,
            otp: {
              code: testOtp,
              used: false,
              sentCount: 10_000,
              failedAttempts: 0,
              lastSentAt: dayjs(),
              expiresAt: dayjs(),
            },
            build: testBuildInfo,
            roles: [Role.player],
          });
          return request(server)
            .post('/auth/init')
            .send({
              mobileNo: testMobileNumber.number,
              build: testBuildInfo,
            })
            .expect(400);
        });
        it('Fail if MSG91 not responding', async () => {
          setupNock(
            config.notification.msg91.baseUrl,
            HttpMethod.post,
            { status: 'unavailable' },
            undefined,
            503,
          );

          return request(server)
            .post('/auth/init')
            .send({
              mobileNo: '1234567890',
              build: testBuildInfo,
            })
            .expect(201);
        });
      });
    });
  });

  describe('Verify Auth', () => {
    describe('Success', () => {
      beforeEach(async () => {
        await e2EServiceManager.authModel.create({
          _id: testMobileNumber,
          otp: {
            code: testOtp,
            used: false,
            sentCount: 1,
            failedAttempts: 0,
            lastSentAt: dayjs(),
            expiresAt: dayjs(),
          },
          build: testBuildInfo,
          roles: [Role.player],
        });
        setupNock(config.auth.ipApiService.baseUrl, HttpMethod.get, {
          status: 'success',
          region: 'state',
        });
        setupNock(config.notification.msg91.baseUrl, HttpMethod.post);
      });
      it('Very First User', async () => {
        await request(server)
          .post('/auth/verify')
          .send({
            mobileNo: testMobileNumber.number,
            otp: testOtp,
            device: testDevice,
          })
          .expect(201);
        const user = (await e2EServiceManager.userModel.findOne({
          mobileNumber: testMobileNumber,
        })) as UserDocument;
        expect(user.username).toBe(`User${config.user.initialUserCounter}`);
      });
      it('Not First User', async () => {
        const currentCounter = config.user.initialUserCounter + 100;
        await e2EServiceManager.userCounterModel.create({
          numericId: currentCounter,
        });
        await request(server)
          .post('/auth/verify')
          .send({
            mobileNo: testMobileNumber.number,
            otp: testOtp,
            device: testDevice,
          })
          .expect(201);
        const user = (await e2EServiceManager.userModel.findOne({
          mobileNumber: testMobileNumber,
        })) as UserDocument;
        expect(user.username).toBe(`User${currentCounter + 1}`);
      });
      it('Expire Signup User', async () => {
        await request(server)
          .post('/auth/init')
          .send({
            mobileNo: '7894561236',
            build: testBuildInfo,
          })
          .expect(201);
        await request(server)
          .post('/auth/verify')
          .send({
            mobileNo: '7894561236',
            otp: '123456',
            device: testDevice,
          })
          .expect(201);
        await request(server).post('/auth/init').send({
          mobileNo: testMobileNumber.number,
          build: testBuildInfo,
        });
        await request(server)
          .post('/auth/verify')
          .send({
            mobileNo: testMobileNumber.number,
            otp: testOtp,
            device: testDevice,
          })
          .expect(201);
      });
    });
    describe('Failure', () => {
      it('No Device', async () => {
        await e2EServiceManager.authModel.create({
          _id: testMobileNumber,
          otp: {
            code: testOtp,
            used: false,
            sentCount: 1,
            failedAttempts: 0,
            lastSentAt: dayjs(),
            expiresAt: dayjs(),
          },
          roles: [Role.player],
        });
        return request(server)
          .post('/auth/verify')
          .send({
            mobileNo: testMobileNumber.number,
            otp: '654321',
          })
          .expect(400);
      });
      it('Wrong OTP', async () => {
        await e2EServiceManager.authModel.create({
          _id: testMobileNumber,
          otp: {
            code: testOtp,
            used: false,
            sentCount: 1,
            failedAttempts: 0,
            lastSentAt: dayjs(),
            expiresAt: dayjs(),
          },
          roles: [Role.player],
        });
        return request(server)
          .post('/auth/verify')
          .send({
            mobileNo: testMobileNumber.number,
            otp: '654321',
            device: testDevice,
          })
          .expect(400);
      });
    });
  });
});
