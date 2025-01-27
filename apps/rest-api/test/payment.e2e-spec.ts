/* eslint-disable unicorn/prevent-abbreviations */
// @ts-expect-error :  Temporary suppression because cashfree-sdk lacks TypeScript definitions.
import * as Cashfree from 'cashfree-sdk';
import * as request from 'supertest';

import {
  lastTdsRecord,
  paymentCashfreeDocument,
  paymentDocument,
  testAccessToken,
  testAmount,
  testCashfreeDepositWebhook,
  testObjectId,
  testOrderId,
  testPaymentLink,
  testPaymentSessionId,
  transactionDocument,
  userDocument,
} from '@lib/fabzen-common/jest/stubs';
import { HttpMethod, setupNock } from '@lib/fabzen-common/jest/setup-nock';
import { config } from '@lib/fabzen-common/configuration';
import {
  CashfreeOrderStatus,
  CashfreePaymentMethod,
  CashfreePaymentStatus,
  Gateway,
  PaymentMethod,
  PayoutType,
  TxnModes,
  TxnStatus,
} from '@lib/fabzen-common/types/payment.types';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import { CashfreePayoutWebhookDto } from '../src/subroutes/payment/payout/payout.dto';

jest.useFakeTimers({ legacyFakeTimers: true });

describe('Payment', () => {
  describe('Deposit', () => {
    describe('Cashfree', () => {
      describe('Create Order', () => {
        describe('Success', () => {
          beforeEach(async () => {
            setupNock(
              config.payment.cashfree.deposit.urls.baseUrl,
              HttpMethod.post,
              {
                order_id: testOrderId,
                payment_session_id: testPaymentSessionId,
              },
            );

            setupNock(
              config.payment.cashfree.deposit.urls.sessionUrl,
              HttpMethod.post,
              { data: { payload: { default: testPaymentLink } } },
            );

            await e2EServiceManager.userModel.create(userDocument);
          });
          it('success', async () => {
            await request(server)
              .post('/payment/deposit/create-order')
              .set('Authorization', 'Bearer ' + testAccessToken)
              .send({
                amount: testAmount,
              })
              .expect(201)
              .expect({
                paymentLink: testPaymentLink,
                orderId: testOrderId,
                gateway: Gateway.cashfree,
                paymentSessionId: testPaymentSessionId,
                paymentMethod: PaymentMethod.upi,
              });
            expect(
              e2EServiceManager.paymentModel.countDocuments({}),
            ).resolves.toBe(1);
          });
        });
      });
      describe('Get Order Status', () => {
        describe('Success', () => {
          beforeEach(async () => {
            await e2EServiceManager.paymentModel.create(paymentDocument);
            setupNock(
              `${config.payment.cashfree.deposit.urls.baseUrl}/${testOrderId}`,
              HttpMethod.get,
              {
                order_status: CashfreeOrderStatus.PAID,
              },
              true,
            );
            setupNock(
              `${config.payment.cashfree.deposit.urls.baseUrl}/${testOrderId}/payments`,
              HttpMethod.get,
              [
                {
                  payment_status: CashfreePaymentStatus.success,
                  payment_method: { [CashfreePaymentMethod.upi]: {} },
                },
              ],
            );
            await e2EServiceManager.userModel.create(userDocument);
          });

          it('success', async () => {
            await request(server)
              .get(`/payment/deposit/order-status/${testOrderId}`)
              .set('Authorization', 'Bearer ' + testAccessToken)
              .expect(200)
              .expect({
                status: TxnStatus.success,
                amount: testAmount,
              });
          });
        });

        describe('Failed Deposit', () => {
          beforeEach(async () => {
            await e2EServiceManager.paymentModel.create(paymentDocument);
            setupNock(
              `${config.payment.cashfree.deposit.urls.baseUrl}/${testOrderId}`,
              HttpMethod.get,
              {
                order_status: CashfreeOrderStatus.PAID,
              },
              true,
            );
            setupNock(
              `${config.payment.cashfree.deposit.urls.baseUrl}/${testOrderId}/payments`,
              HttpMethod.get,
              [
                {
                  payment_status: CashfreePaymentStatus.success,
                  payment_method: { [CashfreePaymentMethod.upi]: {} },
                },
              ],
            );
          });

          it('Wallet Not Found', async () => {
            await request(server)
              .get(`/payment/deposit/order-status/${testOrderId}`)
              .set('Authorization', 'Bearer ' + testAccessToken)
              .expect(404);
          });
        });

        describe('Transaction already exist', () => {
          beforeEach(async () => {
            await e2EServiceManager.userModel.create(userDocument);
            await e2EServiceManager.paymentModel.create(paymentDocument);
            await e2EServiceManager.transactionModel.create(
              transactionDocument,
            );
            setupNock(
              `${config.payment.cashfree.deposit.urls.baseUrl}/${testOrderId}`,
              HttpMethod.get,
              {
                order_status: CashfreeOrderStatus.PAID,
              },
              true,
            );
            setupNock(
              `${config.payment.cashfree.deposit.urls.baseUrl}/${testOrderId}/payments`,
              HttpMethod.get,
              [
                {
                  payment_status: CashfreePaymentStatus.success,
                  payment_method: { [CashfreePaymentMethod.upi]: {} },
                },
              ],
            );
          });

          it('fail', async () => {
            await request(server)
              .get(`/payment/deposit/order-status/${testOrderId}`)
              .set('Authorization', 'Bearer ' + testAccessToken)
              .expect(400);
          });
        });

        describe('Fail', () => {
          it('Order Not Found', async () => {
            await request(server)
              .get(`/payment/deposit/order-status/${testOrderId}`)
              .set('Authorization', 'Bearer ' + testAccessToken)
              .expect(404);
          });
        });
      });
      describe('Get Deposit History', () => {
        it('History', async () => {
          const response = await e2EServiceManager.paymentModel.create({
            orderId: testOrderId,
            userId: toObjectId(testObjectId),
            status: TxnStatus.pending,
            amount: testAmount,
            gateway: Gateway.cashfree,
            mode: TxnModes.deposit,
            settledAmount: testAmount,
          });
          await request(server)
            .get('/payment/deposit/history')
            .set('Authorization', 'Bearer ' + testAccessToken)
            .expect(200)
            .expect({
              history: [
                {
                  orderId: testOrderId,
                  mode: TxnModes.deposit,
                  amount: testAmount,
                  createdAt: response._id.getTimestamp().toISOString(),
                  status: 'pending',
                  gstReward: '0.00',
                  settledAmount: testAmount,
                },
              ],
              meta: {
                totalCount: 1,
                skip: 0,
                limit: 1,
              },
            });
        });
      });
      describe('webhook', () => {
        beforeEach(async () => {
          await e2EServiceManager.paymentModel.create(paymentDocument);
          setupNock(
            `${config.payment.cashfree.deposit.urls.baseUrl}/${testOrderId}`,
            HttpMethod.get,
            {
              order_status: CashfreeOrderStatus.PAID,
            },
            true,
          );
          setupNock(
            `${config.payment.cashfree.deposit.urls.baseUrl}/${testOrderId}/payments`,
            HttpMethod.get,
            [
              {
                payment_status: CashfreePaymentStatus.success,
                payment_method: { [CashfreePaymentMethod.upi]: {} },
              },
            ],
          );
          await e2EServiceManager.userModel.create(userDocument);
        });
        setupNock(
          `${config.payment.cashfree.deposit.urls.baseUrl}/${testOrderId}`,
          HttpMethod.get,
          {
            order_status: CashfreeOrderStatus.PAID,
          },
        );
        it('cashfree webhook', async () => {
          await request(server)
            .post(`/payment/deposit/webhook/cashfree`)
            .send(testCashfreeDepositWebhook)
            .expect(201);
        });
      });
    });
  });
  describe('Payout', () => {
    describe('Cashfree', () => {
      // describe('Create Order', () => {
      //   describe('Success', () => {
      //     let mockUpi: jest.SpyInstance;
      //     let mockAddBeneficiary: jest.SpyInstance;
      //     let mockTransfer: jest.SpyInstance;
      //     beforeEach(async () => {
      //       mockUpi = jest
      //         .spyOn(Cashfree.Payouts.Validation, 'ValidateUPIDetails')
      //         .mockImplementation(() => ({
      //           status: 'SUCCESS',
      //           data: {
      //             nameAtBank: testUserName,
      //             accountExists: 'YES',
      //           },
      //         }));

      //       jest
      //         .spyOn(Cashfree.Payouts.Beneficiary, 'GetBeneId')
      //         .mockImplementation(() => ({
      //           status: 'SUCCESS',
      //         }));

      //       jest
      //         .spyOn(Cashfree.Payouts.Beneficiary, 'Remove')
      //         .mockImplementation(() => ({
      //           status: 'SUCCESS',
      //         }));

      //       mockAddBeneficiary = jest
      //         .spyOn(Cashfree.Payouts.Beneficiary, 'Add')
      //         .mockImplementation(() => ({
      //           status: 'SUCCESS',
      //           message: 'Beneficiary added successfully',
      //         }));
      //       mockTransfer = jest
      //         .spyOn(Cashfree.Payouts.Transfers, 'RequestTransfer')
      //         .mockImplementation(() => ({
      //           status: 'SUCCESS',
      //           subCode: '200',
      //           message: 'Beneficiary added successfully',
      //         }));
      //       jest
      //         .spyOn(Cashfree.Payouts.Transfers, 'GetTransferStatus')
      //         .mockImplementation(() => ({
      //           status: 'SUCCESS',
      //           data: {
      //             transfer: {
      //               status: 'SUCCESS',
      //             },
      //           },
      //         }));
      //       await e2EServiceManager.userModel.create(testuserPayoutDocument);
      //     });

      //     afterEach(() => {
      //       mockAddBeneficiary.mockRestore();
      //       mockUpi.mockRestore();
      //       mockTransfer.mockRestore();
      //       mockTransfer.mockRestore();
      //     });

      //     it('success', async () => {
      //       const response = await request(server)
      //         .post('/payment/payout/create-order')
      //         .set('Authorization', 'Bearer ' + testAccessToken)
      //         .send({
      //           amount: '2',
      //           upiId: 'test@ybl',
      //           payoutType: PayoutType.UPI,
      //         });
      //       expect(response.status).toBe(201);

      //       expect(response.body).toHaveProperty('status', TxnStatus.success);
      //       expect(response.body).toHaveProperty('orderId');
      //       expect(response.body).toHaveProperty('amount');
      //     });
      //   });
      //   describe('failed Payout', () => {
      //     beforeEach(async () => {
      //       jest
      //         .spyOn(Cashfree.Payouts.Validation, 'ValidateUPIDetails')
      //         .mockImplementation(() => ({
      //           status: 'SUCCESS',
      //           data: {
      //             nameAtBank: testUserName,
      //             accountExists: 'YES',
      //           },
      //         }));

      //       jest
      //         .spyOn(Cashfree.Payouts.Beneficiary, 'Add')
      //         .mockImplementation(() => ({
      //           status: 'SUCCESS',
      //           message: 'Beneficiary added successfully',
      //         }));

      //       jest
      //         .spyOn(Cashfree.Payouts.Transfers, 'RequestTransfer')
      //         .mockImplementation(() => ({
      //           status: 'FAILED',
      //           subCode: '200',
      //           message: 'Beneficiary added successfully',
      //         }));
      //       await e2EServiceManager.userModel.create(testuserPayoutDocument);
      //     });

      //     it('Payout failed', async () => {
      //       const response = await request(server)
      //         .post('/payment/payout/create-order')
      //         .set('Authorization', 'Bearer ' + testAccessToken)
      //         .send({
      //           amount: '2',
      //           upiId: 'test@ybl',
      //           payoutType: PayoutType.UPI,
      //         });

      //       expect(response.status).toBe(201);
      //       expect(response.body).toHaveProperty('status', TxnStatus.refund);
      //       expect(response.body).toHaveProperty('orderId');
      //       expect(response.body).toHaveProperty('amount');
      //     });
      //   });
      // });
      describe('webhook', () => {
        let testCashfreePayoutWebhook: CashfreePayoutWebhookDto;
        beforeEach(async () => {
          const data = await e2EServiceManager.paymentModel.create(
            paymentCashfreeDocument,
          );
          jest
            .spyOn(Cashfree.Payouts.Transfers, 'GetTransferStatus')
            .mockImplementation(() => ({
              status: 'SUCCESS',
              data: {
                transfer: {
                  status: 'SUCCESS',
                },
              },
            }));
          await e2EServiceManager.userModel.create(userDocument);
          testCashfreePayoutWebhook = {
            event: 'success',
            transferId: data._id.toString(),
            referenceId: 'gkjhhhiuiuu9',
            signature: 'hihihkjnkjnkjkj',
          };
        });

        it('cashfree payout webhook', async () => {
          await request(server)
            .post(`/payment/payout/webhook/cashfree`)
            .send(testCashfreePayoutWebhook)
            .expect(201);
        });
      });
      describe('Get Payout History', () => {
        it('History', async () => {
          const response = await e2EServiceManager.paymentModel.create({
            orderId: testOrderId,
            userId: toObjectId(testObjectId),
            status: TxnStatus.success,
            amount: testAmount,
            gateway: Gateway.cashfree,
            mode: TxnModes.withdrawal,
            settledAmount: testAmount,
            taxdeduction: lastTdsRecord,
            payoutType: PayoutType.UPI,
          });
          await request(server)
            .get('/payment/payout/history')
            .set('Authorization', 'Bearer ' + testAccessToken)
            .expect(200)
            .expect({
              history: [
                {
                  orderId: testOrderId,
                  mode: TxnModes.withdrawal,
                  amount: testAmount,
                  createdAt: response._id.getTimestamp().toISOString(),
                  status: 'success',
                  settledAmount: testAmount,
                  tdsReward: '0.00',
                  taxDeduction: {
                    financialYear: lastTdsRecord.financialYear,
                    isTdsDeducted: lastTdsRecord.isTdsDeducted,
                    tdsAmount: lastTdsRecord.totalTdsAmountDeducted,
                  },
                  payoutType: PayoutType.UPI,
                },
              ],
              meta: {
                totalCount: 1,
                skip: 0,
                limit: 1,
              },
            });
        });
      });
    });
  });
});
