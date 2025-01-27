import { UserEntity } from '@lib/fabzen-common/entities';
import { MobileNumber } from '@lib/fabzen-common/types/auth.types';
import {
  UserNameProfilePic,
  Wallet,
  UserProfile,
  UpdateStatsDto,
  Games,
  UserGameDetails,
  KycCardType,
  UserGameInfo,
} from '@lib/fabzen-common/types';
import { BuildInfoDto } from '@lib/fabzen-common/dtos/user.common.dto';

import { PlayerStatWithUserId } from 'apps/ludo-gameplay/src/ludo-gameplay.types';
import { UpdateUserDto } from '../../infrastructure/controllers/dtos/user.transporter.dto';
import {
  InAppEventIds,
  UserDetailForNotification,
} from 'apps/notification/src/notification.types';

export abstract class UserRepository {
  abstract createOrUpdateUser(
    mobileNumber: MobileNumber,
    build: BuildInfoDto,
  ): Promise<string>;
  abstract checkIfFirstLogin(mobileNo: MobileNumber): Promise<boolean>;
  abstract getUser(userId: string): Promise<UserEntity | undefined>;
  abstract getUserByMobileNumber(
    mobileNumber: MobileNumber,
  ): Promise<UserEntity | undefined>;
  abstract getUsers(userIds: string[]): Promise<UserEntity[]>;
  abstract getUserWallet(userId: string): Promise<Wallet | undefined>;
  abstract updateUser(updateUserDto: UpdateUserDto): Promise<void>;
  abstract updateUserDevice(updateUserDto: UpdateUserDto): Promise<void>;
  abstract getUserNameProfilePicList(
    userIds: string[],
  ): Promise<UserNameProfilePic[]>;
  abstract getLudoPlayStats(userIds: string[]): Promise<PlayerStatWithUserId[]>;
  abstract getUserByReferralCode(
    referralCode: string,
  ): Promise<string | undefined>;
  abstract createReferral(
    userId: string,
    isReferred: boolean,
    referredUserId: string | undefined,
  ): Promise<void>;
  abstract getUserBlocked(userId: string): Promise<boolean>;
  abstract getUserProfile(userId: string): Promise<UserProfile | undefined>;
  abstract changeBlockStatus(
    userId: string,
    shouldBlock: boolean,
  ): Promise<void>;
  abstract getUserCountry(userId: string): Promise<string>;
  abstract updateUserStats(updateStatsDto: UpdateStatsDto): Promise<void>;
  abstract getUsername(userId: string): Promise<string>;
  abstract getReferredUserId(userId: string): Promise<string | undefined>;
  abstract updateReferralEarning(userId: string, amount: string): Promise<void>;
  abstract updateIp(userId: string, ipAddress: string): Promise<void>;
  abstract getUserGameDetails(
    userId: string,
    game: Games,
  ): Promise<UserGameDetails>;
  abstract getUserDetailsForNotification(
    userIds: string[],
  ): Promise<UserDetailForNotification[]>;
  abstract getUserExternalIdForPushNotification(
    userId: string,
  ): Promise<string>;
  abstract getMassUserExternalIdsForPushNotification(
    userIds: string[],
  ): Promise<string[]>;
  abstract getUserByUserName(userName: string): Promise<UserEntity | undefined>;
  abstract convertToProIfEligible(userId: string): Promise<void>;
  abstract updatePlayedFreeGames(userId: string): Promise<void>;
  abstract getUserInAppEventIds(userId: string): Promise<InAppEventIds>;
  abstract countUserWithSameKycInfo(
    cartType: KycCardType,
    cardNumber: string,
  ): Promise<number>;
  abstract getUsersGameDetails(
    userIds: string[],
    game: Games,
  ): Promise<UserGameInfo[]>;
  abstract availableFreeGameCount(userId: string): Promise<number>;
}

export const createMockUserRepository = (): UserRepository => ({
  createOrUpdateUser: jest.fn(),
  checkIfFirstLogin: jest.fn(),
  getUser: jest.fn(),
  getUserByMobileNumber: jest.fn(),
  getUsers: jest.fn(),
  getUserWallet: jest.fn(),
  updateUser: jest.fn(),
  updateUserDevice: jest.fn(),
  getUserNameProfilePicList: jest.fn(),
  getUserByReferralCode: jest.fn(),
  createReferral: jest.fn(),
  getUserProfile: jest.fn(),
  getUserBlocked: jest.fn(),
  changeBlockStatus: jest.fn(),
  getLudoPlayStats: jest.fn(),
  getUserCountry: jest.fn(),
  updateUserStats: jest.fn(),
  getUsername: jest.fn(),
  getReferredUserId: jest.fn(),
  updateReferralEarning: jest.fn(),
  updateIp: jest.fn(),
  getUserGameDetails: jest.fn(),
  getUserDetailsForNotification: jest.fn(),
  getUserExternalIdForPushNotification: jest.fn(),
  getMassUserExternalIdsForPushNotification: jest.fn(),
  getUserByUserName: jest.fn(),
  convertToProIfEligible: jest.fn(),
  updatePlayedFreeGames: jest.fn(),
  getUserInAppEventIds: jest.fn(),
  countUserWithSameKycInfo: jest.fn(),
  getUsersGameDetails: jest.fn(),
  availableFreeGameCount: jest.fn(),
});
