/* eslint-disable unicorn/prevent-abbreviations */
import * as request from 'supertest';

import {
  testAccessToken,
  testObjectId,
  testObjectId1,
} from '@lib/fabzen-common/jest/stubs';
import { TransactionType } from '@lib/fabzen-common/types';
import { TransactionDocument } from '@lib/fabzen-common/mongoose/models';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';

jest.useFakeTimers({ legacyFakeTimers: true });

describe('Promo', () => {
  describe('Referral', () => {
    let transactionDocument: TransactionDocument;
    beforeEach(() => {
      transactionDocument = new e2EServiceManager.transactionModel({
        userId: toObjectId(testObjectId),
        username: 'User111111',
        type: TransactionType.referral,
        amount: '10',
        referredUserId: toObjectId(testObjectId1),
        referredUserName: 'User111112',
      });
    });
    it('History', async () => {
      const response =
        await e2EServiceManager.transactionModel.create(transactionDocument);
      await request(server)
        .get('/promo/referral/history')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .expect(200)
        .expect({
          history: [
            {
              userName: 'User111112',
              amount: '10',
              createdAt: response._id.getTimestamp().toISOString(),
            },
          ],
          meta: { totalCount: 1, skip: 0, limit: 1 },
        });
    });
  });
});
