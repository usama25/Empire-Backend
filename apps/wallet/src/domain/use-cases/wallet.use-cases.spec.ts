import { NotFoundException } from '@nestjs/common';

import {
  TrasnactionData,
  signupDto,
  testObjectId,
  testOrderId,
  testReferralHistoryResponseDto,
  testSignupBonus,
  testWallet,
} from '@lib/fabzen-common/jest/stubs';

import { createMockWalletRepository } from '../interfaces';
import { WalletUseCases } from './wallet.use-cases';
import { createMockRemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';

describe('Wallet Use Cases ', () => {
  const mockWalletRepository = createMockWalletRepository();
  const mockRemoteConfigService = createMockRemoteConfigService();
  const walletUseCases: WalletUseCases = new WalletUseCases(
    mockWalletRepository,
    mockRemoteConfigService,
  );
  describe('Success', () => {
    it('Get wallet', async () => {
      (mockWalletRepository.getWallet as jest.Mock).mockReturnValue(testWallet);
      const getWallet = await walletUseCases.getWallet(testObjectId);
      expect(getWallet?.main).toBe('10');
      expect(getWallet?.win).toBe('10');
      expect(getWallet?.bonus).toBe('0');
    });
    it('Wallet Not Found', async () => {
      (mockWalletRepository.getWallet as jest.Mock).mockResolvedValue(
        // eslint-disable-next-line unicorn/no-useless-undefined
        undefined,
      );
      expect(walletUseCases.getWallet(testObjectId)).rejects.toThrow(
        NotFoundException,
      );
    });
    it('Credit Deposit To Wallet', async () => {
      const expectedArguments = {
        userId: testObjectId,
        amount: '1',
        orderId: testOrderId,
      };
      (mockWalletRepository.creditDepositToWallet as jest.Mock).mockReturnValue(
        'string',
      );
      await walletUseCases.creditDepositToWallet(expectedArguments);
      expect(mockWalletRepository.creditDepositToWallet).toHaveBeenCalledWith(
        expectedArguments,
      );
    });
    it('Debit payout from Wallet', async () => {
      const expectedArguments = {
        userId: testObjectId,
        amount: '1',
        orderId: testOrderId,
      };
      (mockWalletRepository.debitPayoutFromWallet as jest.Mock).mockReturnValue(
        'string',
      );
      await walletUseCases.creditDepositToWallet(expectedArguments);
      expect(mockWalletRepository.creditDepositToWallet).toHaveBeenCalledWith(
        expectedArguments,
      );
    });
    it('Credit payout Refund to Wallet', async () => {
      const expectedArguments = {
        userId: testObjectId,
        amount: '1',
        orderId: testOrderId,
      };
      (
        mockWalletRepository.creditPayoutRefundToWallet as jest.Mock
      ).mockReturnValue('string');
      await walletUseCases.creditDepositToWallet(expectedArguments);
      expect(mockWalletRepository.creditDepositToWallet).toHaveBeenCalledWith(
        expectedArguments,
      );
    });
    it('Failure to Credit Deposit Amount', async () => {
      const testUserId = 'testUserId';
      const testOrderId = 'testOrderId';
      (
        mockWalletRepository.creditDepositToWallet as jest.Mock
      ).mockRejectedValue(new NotFoundException('Credit deposit failed'));
      await expect(async () => {
        await walletUseCases.creditDepositToWallet({
          userId: testUserId,
          amount: '10',
          orderId: testOrderId,
        });
      }).rejects.toThrow(NotFoundException);
    });
    it('Failure to Debit Payout Amount', async () => {
      const testUserId = 'testUserId';
      const testOrderId = 'testOrderId';
      (
        mockWalletRepository.debitPayoutFromWallet as jest.Mock
      ).mockRejectedValue(new NotFoundException('Credit deposit failed'));
      await expect(async () => {
        await walletUseCases.creditDepositToWallet({
          userId: testUserId,
          amount: '10',
          orderId: testOrderId,
        });
      }).rejects.toThrow(NotFoundException);
    });
    it('Failure to Credit Payout Refund Amount', async () => {
      const testUserId = 'testUserId';
      const testOrderId = 'testOrderId';
      (
        mockWalletRepository.creditPayoutRefundToWallet as jest.Mock
      ).mockRejectedValue(new NotFoundException('Credit deposit failed'));
      await expect(async () => {
        await walletUseCases.creditDepositToWallet({
          userId: testUserId,
          amount: '10',
          orderId: testOrderId,
        });
      }).rejects.toThrow(NotFoundException);
    });
    it('Referral History', async () => {
      (mockWalletRepository.getReferralHistory as jest.Mock).mockReturnValue(
        testReferralHistoryResponseDto,
      );
      const referralHistory = await walletUseCases.getReferralHistory({
        userId: testObjectId,
        skip: 0,
        limit: 10,
      });
      expect(referralHistory).toBe(testReferralHistoryResponseDto);
    });
    it('credit signup Bonus', async () => {
      (mockRemoteConfigService.getSignupBonus as jest.Mock).mockReturnValue(
        testSignupBonus,
      );
      await walletUseCases.creditSignupBonus(testObjectId);
      expect(mockWalletRepository.creditSignupBonus).toHaveBeenCalledWith(
        signupDto,
      );
    });
    it('expire Bonus', async () => {
      (
        mockWalletRepository.getExpiredBonusTransactions as jest.Mock
      ).mockResolvedValue([TrasnactionData]);
      await walletUseCases.expiredBonus(testObjectId);
    });
    it('expire Bonus', async () => {
      const testUserId = 'testUserId';
      (
        mockWalletRepository.getExpiredBonusTransactions as jest.Mock
      ).mockRejectedValue(new NotFoundException('Expire Bonus failed'));

      await expect(async () => {
        await walletUseCases.expiredBonus(testUserId);
      }).rejects.toThrow(NotFoundException);
    });
  });
});
