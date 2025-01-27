/* eslint-disable unicorn/prevent-abbreviations */
import * as request from 'supertest';

import {
  testAccessToken,
  testAccessTokenForAdmin,
  testDevice,
  testEmail,
  testGenerateOtpResponse,
  testKyc,
  testMobileNumber,
  testMobileNumber1,
  testObjectId,
  testObjectId1,
  testPanUploadResponse,
  testReferral,
  testStats,
  testSubmitOtpResponse,
  testUserName,
} from '@lib/fabzen-common/jest/stubs';
import { Role } from '@lib/fabzen-common/types';
import { HttpMethod, setupNock } from '@lib/fabzen-common/jest/setup-nock';
import { config } from '@lib/fabzen-common/configuration';
import { UserDocument } from '@lib/fabzen-common/mongoose/models';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';

const filePath = 'assets/test-files/test.jpg';

jest.useFakeTimers({ legacyFakeTimers: true });

describe('User', () => {
  let userDocument: UserDocument;
  let otherUserDocument: UserDocument;
  beforeEach(() => {
    userDocument = new e2EServiceManager.userModel({
      _id: toObjectId(testObjectId),
      username: testUserName,
      roles: [Role.player],
      mobileNumber: testMobileNumber,
      wallet: {
        main: '0',
        win: '0',
        bonus: '0',
      },
      referral: testReferral,
      email: testEmail,
      avatar: 1,
      isEmailVerified: false,
      device: {},
    });
    otherUserDocument = new e2EServiceManager.userModel({
      _id: toObjectId(testObjectId1),
      username: 'testUserName1',
      roles: [Role.player],
      mobileNumber: testMobileNumber1,
      wallet: {
        main: '0',
        win: '0',
        bonus: '0',
      },
      referral: {
        code: 'MONKEY',
        count: 0,
        earning: '0',
        canBeReferred: true,
      },
      email: testEmail,
      avatar: 1,
      isEmailVerified: false,
      device: {},
    });
  });
  describe('Get My User Info', () => {
    it('Success', async () => {
      await e2EServiceManager.userModel.create(userDocument);
      return request(server)
        .get('/users/me')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .expect(200)
        .expect({
          userId: testObjectId,
          username: testUserName,
          mobileNumber: testMobileNumber,
          wallet: {
            main: '0',
            win: '0',
            bonus: '0',
          },
          stats: testStats,
          referral: testReferral,
          email: testEmail,
          isProActive: false,
          avatar: 1,
          rank: config.gameHistory.leaderboard.maxEntries + 1,
          availableFreeGameCount: 10,
          isFreeGameAvailable: true,
          isEmailVerified: false,
          isKycVerified: false,
          isAddressValid: false,
          isConvertedToPro: true,
        });
    });
    it('Fail', async () => {
      return request(server)
        .get('/users/me')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .expect(404);
    });
  });
  describe('Update User', () => {
    it('Success', async () => {
      const newName = 'newName';
      await e2EServiceManager.userModel.create(userDocument);
      await request(server)
        .put('/users/me')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .send({
          name: newName,
        })
        .expect(200);
      const updatedUserDocument = (await e2EServiceManager.userModel.findById(
        testObjectId,
      )) as UserDocument;
      expect(updatedUserDocument.name).toBe(newName);
    });
    it('Fail', async () => {
      return request(server)
        .get('/users/me')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .expect(404);
    });
  });
  describe('Update Device', () => {
    it('Success', async () => {
      return request(server)
        .put('/users/update-device')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .send({
          device: testDevice,
        })
        .expect(200);
    });
    it('Fail', async () => {
      return request(server)
        .put('/users/update-device')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .expect(400);
    });
  });
  describe('Upload Kyc', () => {
    setupNock(`${config.user.surepass.baseUrl}/ocr/pan`, HttpMethod.post, {
      ...testPanUploadResponse,
    });
    it('Success', async () => {
      return request(server)
        .post('/users/upload-kyc')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .attach('frontImage', filePath)
        .expect(201);
    });
  });
  describe('Upload Kyc (Fail)', () => {
    testPanUploadResponse.status_code = 400;
    setupNock(`${config.user.surepass.baseUrl}/ocr/pan`, HttpMethod.post, {
      ...testPanUploadResponse,
    });
    it('Fail', async () => {
      return request(server)
        .post('/users/upload-kyc')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .attach('frontImage', filePath)
        .expect(201);
    });
  });
  describe('Generate Kyc Otp', () => {
    setupNock(
      `${config.user.surepass.baseUrl}/aadhaar-v2/generate-otp`,
      HttpMethod.post,
      {
        ...testGenerateOtpResponse,
      },
    );
    it('Success', async () => {
      return request(server)
        .post('/users/aadhaar-kyc')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .send({ aadhaarId: '123456' })
        .expect(201);
    });
  });
  describe('Generate Kyc Otp (Fail)', () => {
    testGenerateOtpResponse.status_code = 400;
    setupNock(
      `${config.user.surepass.baseUrl}/aadhaar-v2/generate-otp`,
      HttpMethod.post,
      {
        ...testGenerateOtpResponse,
      },
    );
    it('Fail', async () => {
      return request(server)
        .post('/users/aadhaar-kyc')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .send({ aadhaarId: '123456' })
        .expect(400);
    });
  });
  describe('Submit Otp', () => {
    setupNock(
      `${config.user.surepass.baseUrl}/aadhaar-v2/submit-otp`,
      HttpMethod.post,
      {
        ...testSubmitOtpResponse,
      },
    );
    it('Success', async () => {
      return request(server)
        .post('/users/aadhaar-otp-verify')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .send({ clientId: '123456', otp: '123456' })
        .expect(201);
    });
  });
  describe('Submit Otp (Fail)', () => {
    testSubmitOtpResponse.status_code = 400;
    setupNock(
      `${config.user.surepass.baseUrl}/aadhaar-v2/submit-otp`,
      HttpMethod.post,
      {
        ...testSubmitOtpResponse,
      },
    );
    it('Fail', async () => {
      return request(server)
        .post('/users/aadhaar-otp-verify')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .send({ clientId: '123456', otp: '123456' })
        .expect(201);
    });
  });
  describe('Submit Otp (Age Fail)', () => {
    testSubmitOtpResponse.data.dob = '2008-02-13';
    setupNock(
      `${config.user.surepass.baseUrl}/aadhaar-v2/submit-otp`,
      HttpMethod.post,
      {
        ...testSubmitOtpResponse,
      },
    );
    it('Fail', async () => {
      return request(server)
        .post('/users/aadhaar-otp-verify')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .send({ clientId: '123456', otp: '123456' })
        .expect(201);
    });
  });
  describe('Get wallet', () => {
    it('Success', async () => {
      await e2EServiceManager.userModel.create(userDocument);
      await request(server)
        .get('/users/wallet')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .expect(200)
        .expect({ main: '0', win: '0', bonus: '0' });
    });
    it('No Wallet', async () => {
      return request(server)
        .get('/users/wallet')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .expect(404);
    });
  });
  describe('Create Referral', () => {
    describe('Success', () => {
      beforeEach(async () => {
        await e2EServiceManager.userModel.create(userDocument);
        await e2EServiceManager.userModel.create(otherUserDocument);
      });
      it('Referred', async () => {
        return request(server)
          .post('/users/create-referral')
          .set('Authorization', 'Bearer ' + testAccessToken)
          .send({ isReferred: true, referralCode: 'MONKEY' })
          .expect(201);
      });
      it('Not Referred', async () => {
        return request(server)
          .post('/users/create-referral')
          .set('Authorization', 'Bearer ' + testAccessToken)
          .send({ isReferred: false })
          .expect(201);
      });
    });

    describe('Fail', () => {
      it('No User With Such Referral Code.', async () => {
        await e2EServiceManager.userModel.create(userDocument);
        return request(server)
          .post('/users/create-referral')
          .set('Authorization', 'Bearer ' + testAccessToken)
          .send({ referralCode: 'MONKEY' })
          .expect(400);
      });
      it('Can not refer itself', async () => {
        await e2EServiceManager.userModel.create(userDocument);
        return request(server)
          .post('/users/create-referral')
          .set('Authorization', 'Bearer ' + testAccessToken)
          .send({ referralCode: 'RANDOM' })
          .expect(400);
      });
      it('Already Referred.', async () => {
        userDocument.referral.user = toObjectId(testObjectId1);
        userDocument.referral.canBeReferred = false;
        await e2EServiceManager.userModel.create(userDocument);
        await e2EServiceManager.userModel.create(otherUserDocument);
        return request(server)
          .post('/users/create-referral')
          .set('Authorization', 'Bearer ' + testAccessToken)
          .send({ referralCode: 'MONKEY' })
          .expect(400);
      });
    });
  });
});

describe('User (Have Kyc)', () => {
  let userDocument: UserDocument;
  beforeEach(() => {
    userDocument = new e2EServiceManager.userModel({
      _id: toObjectId(testObjectId),
      username: testUserName,
      name: testUserName,
      roles: [Role.player],
      mobileNumber: testMobileNumber,
      wallet: {
        main: '0',
        win: '0',
        bonus: '0',
      },
      referral: testReferral,
      kyc: testKyc,
      stats: testStats,
      email: testEmail,
      avatar: 1,
      isEmailVerified: false,
      device: {},
      isConvertedToPro: true,
    });
  });
  describe('Get My User Info', () => {
    it('Success', async () => {
      await e2EServiceManager.userModel.create(userDocument);
      return request(server)
        .get('/users/me')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .expect(200)
        .expect({
          userId: testObjectId,
          username: testUserName,
          name: testUserName,
          mobileNumber: testMobileNumber,
          wallet: {
            main: '0',
            win: '0',
            bonus: '0',
          },
          stats: testStats,
          referral: testReferral,
          email: testEmail,
          avatar: 1,
          rank: config.gameHistory.leaderboard.maxEntries + 1,
          isProActive: false,
          availableFreeGameCount: 10,
          isFreeGameAvailable: true,
          isEmailVerified: false,
          isKycVerified: true,
          isAddressValid: false,
          isConvertedToPro: true,
        });
    });
  });
});

describe('Block/Unblock User', () => {
  it('Not allowed for non admin users', async () => {
    return request(server)
      .patch('/users/change-block-status')
      .set('Authorization', 'Bearer ' + testAccessToken)
      .send({ shouldBlock: false })
      .expect(403);
  });
  describe('Success', () => {
    beforeEach(async () => {
      await e2EServiceManager.userModel.create({
        _id: toObjectId(testObjectId),
        username: testUserName,
        name: testUserName,
        roles: [Role.player],
        mobileNumber: testMobileNumber,
        wallet: {
          main: '0',
          win: '0',
          bonus: '0',
        },
        referral: testReferral,
        email: testEmail,
        rank: 1,
        avatar: 1,
        isEmailVerified: false,
        device: {},
        isBlocked: true,
      });
    });

    it('Blocking', async () => {
      await request(server)
        .patch('/users/change-block-status')
        .set('Authorization', 'Bearer ' + testAccessTokenForAdmin)
        .send({ userId: testObjectId, shouldBlock: true })
        .expect(200);
      const updatedUser = await e2EServiceManager.userModel.findOne({});
      expect(updatedUser.isBlocked).toBe(true);
    });

    it('Unblocking', async () => {
      await request(server)
        .patch('/users/change-block-status')
        .set('Authorization', 'Bearer ' + testAccessTokenForAdmin)
        .send({ userId: testObjectId, shouldBlock: false })
        .expect(200);
      const updatedUser = await e2EServiceManager.userModel.findOne({});
      expect(updatedUser.isBlocked).toBe(false);
    });
  });
});
