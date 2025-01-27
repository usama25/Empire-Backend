/* eslint-disable unicorn/prevent-abbreviations */
import * as request from 'supertest';

import { testAccessToken, testObjectId } from '@lib/fabzen-common/jest/stubs';
import { TransactionType } from '@lib/fabzen-common/types';
import { TransactionDocument } from '@lib/fabzen-common/mongoose/models';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';

jest.useFakeTimers({ legacyFakeTimers: true });

describe('Transaction', () => {
  describe('Bonus', () => {
    let transactionDocument: TransactionDocument;
    beforeEach(() => {
      transactionDocument = new e2EServiceManager.transactionModel({
        userId: toObjectId(testObjectId),
        username: 'User111111',
        type: TransactionType.signupBonus,
        amount: '500',
      });
    });
    it('History', async () => {
      const response =
        await e2EServiceManager.transactionModel.create(transactionDocument);
      await request(server)
        .get('/transactions/bonus/history')
        .set('Authorization', 'Bearer ' + testAccessToken)
        .expect(200)
        .expect({
          history: [
            {
              amount: '500',
              createdAt: response._id.getTimestamp().toISOString(),
              type: TransactionType.signupBonus,
            },
          ],
          meta: { totalCount: 1, skip: 0, limit: 1 },
        });
    });
  });
});
