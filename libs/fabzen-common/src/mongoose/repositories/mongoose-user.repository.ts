import { Model } from 'mongoose';
import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as dayjs from 'dayjs';

import {
  User,
  Counter,
  UserDocument,
  CounterDocument,
} from '@lib/fabzen-common/mongoose/models/user.schema';

import { Leaderboard, LeaderboardDocument } from '../models/leaderboard.schema';

import {
  UserNameProfilePic,
  Wallet,
  MobileNumber,
  Stats,
  UserProfile,
  GameOutcome,
  UpdateStatsDto,
  Country,
  Games,
  DWM,
  UserGameDetails,
  KycCardType,
  UserGameInfo,
} from '@lib/fabzen-common/types';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import { config } from '@lib/fabzen-common/configuration';
import { UserEntity } from '@lib/fabzen-common/entities';
import { testStats } from '@lib/fabzen-common/jest/stubs';
import { BuildInfoDto } from '@lib/fabzen-common/dtos/user.common.dto';
import {
  getCountryFromMobileNumber,
  maskMobileNumber,
} from '@lib/fabzen-common/utils/mobile-number.utils';
import { RemoteConfigService } from '@lib/fabzen-common/remote-config/remote-config.interface';
import { GameHistory, GameHistoryDocument } from '../models';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { UpdateUserDto } from 'apps/user/src/infrastructure/controllers/dtos/user.transporter.dto';
import { PlayerStatWithUserId } from 'apps/ludo-gameplay/src/ludo-gameplay.types';
import {
  InAppEventIds,
  UserDetailForNotification,
} from 'apps/notification/src/notification.types';
import { maskIP } from '@lib/fabzen-common/utils/string.utils';

@Injectable()
export class MongooseUserRepository implements UserRepository {
  constructor(
    @InjectModel(User.name)
    public userModel: Model<UserDocument>,
    @InjectModel(GameHistory.name)
    public gameHistoryModel: Model<GameHistoryDocument>,
    @InjectModel(Leaderboard.name)
    public leaderboardModel: Model<LeaderboardDocument>,
    @InjectModel(Counter.name)
    public counterModel: Model<CounterDocument>,
    private readonly remoteConfigService: RemoteConfigService,
  ) {}

  async createOrUpdateUser(
    mobileNumber: MobileNumber,
    build: BuildInfoDto,
  ): Promise<string> {
    const existingUser = await this.userModel.findOne(
      { mobileNumber },
      { _id: 1, build: 1 },
    );
    if (existingUser) {
      const oldBuild = existingUser.build;
      const fromFreeApp = this.#wasFromFreeApp(oldBuild);
      const toProApp = this.#isToFreeApp(build);
      if (!fromFreeApp && !toProApp) {
        // If this user is switching from Pro app to Free app, Reject
        throw new HttpException(
          {
            statusCode: 402,
            message: "Can't use Playstore Build",
          },
          402,
        );
      }

      await this.userModel.findOneAndUpdate(
        { mobileNumber },
        { $set: { build } },
      );

      return existingUser._id.toString();
    } else {
      const userDocument = await this.#createUserDocument(mobileNumber, build);
      const newUser = await userDocument.save();
      return newUser._id.toString();
    }
  }

  async checkIfFirstLogin(mobileNumber: MobileNumber): Promise<boolean> {
    const existingUser = await this.userModel.findOne(
      { mobileNumber },
      { _id: 1, build: 1 },
    );
    return existingUser ? false : true;
  }

  #wasFromFreeApp(oldBuild: BuildInfoDto | undefined): boolean {
    return !oldBuild || oldBuild.isPlayStoreBuild;
  }

  #isToFreeApp(build: BuildInfoDto): boolean {
    return !build.isPlayStoreBuild;
  }

  async getUser(userId: string): Promise<UserEntity | undefined> {
    const userDocument = await this.userModel.findById<UserDocument>(userId);
    return userDocument
      ? await this.#convertDocumentToEntity(userDocument)
      : undefined;
  }

  async getUserByMobileNumber(
    mobileNumber: MobileNumber,
  ): Promise<UserEntity | undefined> {
    const userDocument = await this.userModel.findOne<UserDocument>({
      mobileNumber,
    });
    return userDocument
      ? await this.#convertDocumentToEntity(userDocument)
      : undefined;
  }

  async getUsers(userIds: string[]): Promise<UserEntity[]> {
    const userDocuments = await this.userModel.find({ _id: { $in: userIds } });
    return Promise.all(
      userDocuments.map(
        async (document) => await this.#convertDocumentToEntity(document),
      ),
    );
  }

  async getUserBlocked(userId: string): Promise<boolean> {
    const userDocument = await this.userModel.findById<UserDocument>(userId, {
      isBlocked: 1,
    });
    if (userDocument && userDocument.isBlocked) {
      return true;
    }
    return false;
  }

  async getUserCountry(userId: string): Promise<string> {
    const userDocument = await this.userModel.findById<UserDocument>(userId, {
      address: 1,
    });
    return userDocument?.address?.country ?? Country.India;
  }

  async getUserByReferralCode(
    referralCode: string,
  ): Promise<string | undefined> {
    const userDocument = await this.userModel.findOne<UserDocument>(
      {
        'referral.code': referralCode,
      },
      {
        _id: 1,
      },
    );

    return userDocument ? userDocument._id.toString() : undefined;
  }

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const userDocument = await this.userModel.findById<UserDocument>(userId);
    if (userDocument) {
      const { username, name, avatar } =
        await this.#convertDocumentToEntity(userDocument);
      return {
        userId,
        username,
        name: name || username,
        avatar,
      };
    } else {
      return undefined;
    }
  }

  async updateUser(updateUserDto: UpdateUserDto): Promise<void> {
    const { userId, address, build, externalIds, ...updateInfo } =
      updateUserDto;
    const user = await this.userModel.findById(userId, {
      _id: 0,
      build: 1,
    });

    const updateQuery: Record<string, any> = {
      ...updateInfo,
    };
    // In case we need to update only subset of address (e.g. only state)
    if (address) {
      for (const [field, value] of Object.entries(address)) {
        // Country Update is NOT allowed
        if (field !== 'country' && !!value) {
          updateQuery[`address.${field}`] = value;
        }
      }
    }

    // In case we need to update only subset of build info (e.g. only install source)
    if (build) {
      for (const [field, value] of Object.entries(build)) {
        if (value !== undefined) {
          if (
            field === 'isPlayStoreBuild' && // If this user is switching from Pro app to Free app, Reject
            user
          ) {
            const oldBuild = user.build;
            const fromFreeApp = this.#wasFromFreeApp(oldBuild);
            const toProApp = !(value as boolean);
            if (!fromFreeApp && !toProApp) {
              // If this user is switching from Pro app to Free app, Reject
              throw new HttpException(
                {
                  statusCode: 402,
                  message: "Can't use Playstore Build",
                },
                402,
              );
            }
          }
          updateQuery[`build.${field}`] = value;
        }
      }
    }
    // In case of patching externalIds, we need to add baseAfId or proAfId based on build info (isPlayStoreBuild)
    if (externalIds) {
      for (const [field, value] of Object.entries(externalIds)) {
        updateQuery[`externalIds.${field}`] = value;
      }
      const isPlayStoreBuild = !!user?.build.isPlayStoreBuild;
      const { afId } = externalIds;
      if (isPlayStoreBuild) {
        updateQuery[`externalIds.baseAfId`] = afId;
      } else {
        updateQuery[`externalIds.proAfId`] = afId;
      }
    }

    try {
      await this.userModel.findByIdAndUpdate(userId, {
        $set: updateQuery,
      });
    } catch (error) {
      console.log(error);
    }
  }

  async updateUserDevice(updateUserDeviceDto: UpdateUserDto): Promise<void> {
    const { userId, deviceInfo } = updateUserDeviceDto;

    const updateQuery: Record<string, any> = {
      deviceInfo,
    };
    await this.userModel.findByIdAndUpdate(userId, {
      $set: updateQuery,
    });
  }

  async createReferral(
    userId: string,
    isReferred: boolean,
    referredUserId: string | undefined,
  ) {
    if (isReferred) {
      await this.userModel.findByIdAndUpdate(userId, {
        $set: {
          'referral.user': toObjectId(referredUserId as string),
          'referral.canBeReferred': false,
        },
      });
      await this.userModel.findByIdAndUpdate(referredUserId as string, {
        $inc: {
          'referral.count': 1,
        },
      });
    } else {
      await this.userModel.findByIdAndUpdate(userId, {
        $set: {
          'referral.canBeReferred': false,
        },
      });
    }
  }

  async #getLeaderboardRank(userId: string): Promise<number> {
    const leaderboard = await this.leaderboardModel.findOne({
      userId,
      game: Games.empiregames,
      dwm: DWM.day,
    });
    return leaderboard
      ? leaderboard.rank
      : config.gameHistory.leaderboard.maxEntries + 1;
  }

  async #createUserDocument(
    mobileNumber: MobileNumber,
    build: BuildInfoDto,
  ): Promise<UserDocument> {
    const userCounter = await this.#getNextUserCounter();
    return new this.userModel({
      username: `User${userCounter}`,
      mobileNumber,
      build,
      address: {
        country: getCountryFromMobileNumber(mobileNumber),
      },
    });
  }

  async #getNextUserCounter(): Promise<number> {
    const count = await this.counterModel.find();
    if (count.length === 0) {
      const initialUserCounter = config.user.initialUserCounter;
      const countererDocument = new this.counterModel({
        numericId: initialUserCounter,
      });
      await countererDocument.save();
      return initialUserCounter;
    } else {
      const nextUserCounter = count[0].numericId + 1;
      await this.counterModel.updateOne({ numericId: nextUserCounter });
      return nextUserCounter;
    }
  }

  async #convertDocumentToEntity(
    userDocument: UserDocument,
  ): Promise<UserEntity> {
    const {
      _id,
      username,
      mobileNumber,
      avatar,
      wallet,
      kyc,
      stats,
      externalIds,
      name,
      email,
      ipAddress,
      referral,
      address,
      device,
      isEmailVerified,
      isProActive,
      build,
    } = userDocument;

    const isKycVerified = kyc ? kyc.status : false;
    const kycModifiedCount = kyc ? kyc.modifiedCount : 0;
    const isAddressValid = !!address?.address1;
    const rank = await this.#getLeaderboardRank(_id.toString());
    let newStats: Stats = testStats;
    if (stats) {
      newStats = stats;
    }
    const userEntity = new UserEntity(
      _id.toString(),
      username,
      mobileNumber,
      avatar,
      wallet,
      referral,
      isEmailVerified,
      rank,
      newStats,
      isKycVerified,
      kycModifiedCount,
      isAddressValid,
      !!build?.isPlayStoreBuild,
      name,
      isProActive,
      externalIds,
      email,
      ipAddress,
      address,
      device,
      build,
    );
    return userEntity;
  }

  async getUserWallet(userId: string): Promise<Wallet> {
    const userDocument = await this.userModel.findById<UserDocument>(userId, {
      _id: 0,
      wallet: 1,
    });
    if (!userDocument) {
      throw new NotFoundException('No Wallet');
    }
    return userDocument.wallet;
  }

  async getUserNameProfilePicList(
    userIds: string[],
  ): Promise<UserNameProfilePic[]> {
    const userDocument = await this.userModel.find<UserDocument>(
      { _id: { $in: userIds } },
      {
        username: 1,
        name: 1,
        avatar: 1,
      },
    );
    return userDocument.map(({ _id, username, name, avatar }) => ({
      userId: _id.toString(),
      username,
      name: name || username,
      avatar,
    }));
  }

  async getLudoPlayStats(userIds: string[]): Promise<PlayerStatWithUserId[]> {
    const userDocument = await this.userModel.find<UserDocument>(
      { _id: { $in: userIds } },
      {
        stats: 1,
      },
    );
    return userDocument.map(({ _id, stats }) => ({
      userId: _id.toString(),
      won: stats?.ludo?.winMatches ?? 0,
      lost: stats?.ludo?.lossMatches ?? 0,
    }));
  }

  async changeBlockStatus(userId: string, shouldBlock: boolean): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        isBlocked: shouldBlock,
      },
    });
  }

  async updateUserStats(updateStatsDto: UpdateStatsDto) {
    const { userId, winLoseAmount, outcome, game } = updateStatsDto;
    await (outcome === GameOutcome.won
      ? this.userModel.findByIdAndUpdate(userId, {
          $inc: {
            [`stats.${game}.winMatches`]: 1,
            [`stats.${game}.earnedMoney`]: winLoseAmount,
          },
        })
      : this.userModel.findByIdAndUpdate(userId, {
          $inc: {
            [`stats.${game}.lossMatches`]: 1,
          },
        }));

    if (game === Games.aviator && outcome === GameOutcome.won) {
      this.userModel.findByIdAndUpdate(userId, {
        $inc: {
          [`stats.${game}.lossMatches`]: -1,
        },
      });
    }

    const currentUser = await this.userModel.findById(userId).exec();
    if (currentUser) {
      let winMatches = currentUser.stats.callbreak?.winMatches || 0;
      let lossMatches = currentUser.stats.callbreak?.lossMatches || 0;

      outcome === GameOutcome.won ? (winMatches += 1) : (lossMatches += 1);
    }
  }

  async getUsername(userId: string): Promise<string> {
    const userDocument = await this.userModel.findById(userId, {
      _id: 0,
      name: 1,
      username: 1,
    });
    return (userDocument?.name || userDocument?.username) ?? 'UNKOWN';
  }

  async getReferredUserId(userId: string): Promise<string | undefined> {
    const userDocument = await this.userModel.findById<UserDocument>(userId);

    return userDocument?.referral?.user?.toString() ?? undefined;
  }

  async updateReferralEarning(userId: string, amount: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $inc: { 'referral.earning': amount },
    });
  }

  async updateIp(userId: string, ipAddress: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { ipAddress: ipAddress },
    });
  }

  #maskIP(ipAddress: string | undefined) {
    if (!ipAddress) {
      return '';
    }
    const parts = ipAddress.split('.');
    return parts[0] + '.***.***.' + parts[3];
  }

  #maskMobileNumber(mobileNumber: MobileNumber) {
    return {
      ...mobileNumber,
      number:
        mobileNumber.number.slice(0, 3) +
        '****' +
        mobileNumber.number.slice(-3),
    };
  }

  async getUserGameDetails(
    userId: string,
    game: Games,
  ): Promise<UserGameDetails> {
    const user = await this.userModel.findById<UserDocument>(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const {
      username,
      name,
      ipAddress,
      avatar,
      stats,
      mobileNumber,
      address,
      kyc,
    } = user;
    const rank = await this.#getLeaderboardRank(userId);
    const matches =
      stats && stats[game]
        ? (stats[game]?.winMatches ?? 0) + (stats[game]?.lossMatches ?? 0)
        : 0;
    const isKycVerified = kyc ? kyc.status : false;
    return {
      userId,
      name,
      username,
      ip: maskIP(ipAddress),
      avatar,
      rank,
      matches,
      isKycVerified,
      mobileNumber: maskMobileNumber(mobileNumber),
      address,
      stats: stats ? stats[game] : undefined,
    };
  }

  async getUserDetailsForNotification(
    userIds: string[],
  ): Promise<UserDetailForNotification[]> {
    const userObjectIds = userIds.map((userId) => toObjectId(userId));
    const userDocuments = await this.userModel.find(
      {
        _id: { $in: userObjectIds },
      },
      {
        _id: 0,
        'externalIds.oneSignalId': 1,
        'build.isGlobalBuild': 1,
      },
    );
    return userDocuments.map(({ externalIds, build }) => ({
      id: externalIds.oneSignalId,
      isGlobalBuild: build.isGlobalBuild,
    }));
  }

  async getUserExternalIdForPushNotification(userId: string): Promise<string> {
    const userDocument = await this.userModel.findById(userId, {
      _id: 0,
      'externalIds.oneSignalId': 1,
    });
    const externalId = userDocument?.externalIds?.oneSignalId;
    if (!externalId) {
      throw new NotFoundException(`${userId} does not have External Id for PN`);
    }
    return externalId;
  }

  async getMassUserExternalIdsForPushNotification(
    userIds: string[],
  ): Promise<string[]> {
    const userDocuments = await this.userModel.find(
      {
        _id: { $in: userIds.map((userId) => toObjectId(userId)) },
      },
      {
        _id: 0,
        'externalIds.oneSignalId': 1,
      },
    );
    return userDocuments
      .filter(
        (userDocument) =>
          userDocument.externalIds && userDocument.externalIds.oneSignalId,
      )
      .map((userDocument) => userDocument.externalIds.oneSignalId)
      .filter((id) => {
        const pattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
        return pattern.test(id);
      });
  }

  async getUserByUserName(username: string): Promise<UserEntity | undefined> {
    const user = await this.userModel.findOne({ username });
    return user ? this.#convertDocumentToEntity(user) : undefined;
  }

  async convertToProIfEligible(userId: string): Promise<void> {
    const winningsToPro = this.remoteConfigService.getWinningsToPro();
    const user = await this.userModel.findById(userId, { _id: 0, stats: 1 });
    if (!user) {
      throw new NotFoundException(`User ${userId} does not exists`);
    }
    const { stats } = user;
    const totalEarning = this.#getTotalEarning(stats);
    if (totalEarning >= winningsToPro) {
      await this.userModel.findByIdAndUpdate(userId, {
        $set: {
          isProActive: true,
        },
      });
    }
  }

  async updatePlayedFreeGames(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $inc: {
        playedFreeGames: 1,
      },
    });
  }

  #getTotalEarning(stats: Stats): number {
    if (!stats) {
      return 0;
    }
    return Object.values(stats).reduce((accumulator, gameStats) => {
      return accumulator + (gameStats?.earnedMoney ?? 0);
    }, 0);
  }

  async getUserInAppEventIds(userId: string): Promise<InAppEventIds> {
    const userDocument = await this.userModel.findById(userId, {
      _id: 0,
      'externalIds.baseAfId': 1,
      'externalIds.proAfId': 1,
    });

    return {
      pro: userDocument?.externalIds?.proAfId,
      base: userDocument?.externalIds?.baseAfId,
    };
  }

  async countUserWithSameKycInfo(
    cartType: KycCardType,
    cardNumber: string,
  ): Promise<number> {
    return await this.userModel.countDocuments({
      'kyc.data.cardType': cartType,
      'kyc.data.cardNumber': cardNumber,
    });
  }

  async getUsersGameDetails(
    userIds: string[],
    game: Games,
  ): Promise<UserGameInfo[]> {
    const userObjectIds = userIds.map((userId) => toObjectId(userId));
    const userDocuments = await this.userModel.find<UserDocument>(
      {
        _id: { $in: userObjectIds },
      },
      {
        name: 1,
        username: 1,
        ipAddress: 1,
        avatar: 1,
        stats: 1,
        mobileNumber: 1,
        address: 1,
        kyc: 1,
      },
    );

    const users = [];
    for (const userDoucment of userDocuments) {
      const {
        _id,
        username,
        name,
        ipAddress,
        avatar,
        stats,
        mobileNumber,
        address,
        kyc,
      } = userDoucment;
      const userId = _id.toString();
      const rank = await this.#getLeaderboardRank(userId);
      const matches =
        stats && stats[game]
          ? (stats[game]?.winMatches ?? 0) + (stats[game]?.lossMatches ?? 0)
          : 0;
      const isKycVerified = kyc ? kyc.status : false;
      users.push({
        userId,
        username: name || username,
        ip: this.#maskIP(ipAddress),
        avatar,
        rank,
        matches,
        isKycVerified,
        mobileNumber: this.#maskMobileNumber(mobileNumber),
        address,
        isReady: false,
      });
    }
    return users;
  }

  async availableFreeGameCount(userId: string): Promise<number> {
    const user = await this.userModel.findById(userId, {
      _id: 0,
      isProActive: 1,
      playedFreeGames: 1,
      freeGamesUpdatedAt: 1,
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const startTime = dayjs()
      .add(5.5, 'hours')
      .startOf('day')
      .subtract(5.5, 'hours')
      .toDate();

    const { freeGamesUpdatedAt, isProActive } = user;
    if (!isProActive) {
      // Return Any Positive number
      return 10;
    }

    let { playedFreeGames } = user;
    if (freeGamesUpdatedAt) {
      if (dayjs(freeGamesUpdatedAt).isBefore(startTime)) {
        await this.userModel.findByIdAndUpdate(userId, {
          playedFreeGames: 0,
          freeGamesUpdatedAt: startTime,
        });
        playedFreeGames = 0;
      }
    } else {
      const freeGamesCountFromGameHistory =
        await this.gameHistoryModel.countDocuments({
          createdAt: { $gt: startTime },
          userId: toObjectId(userId),
          joinFee: '0',
        });
      await this.userModel.findByIdAndUpdate(userId, {
        playedFreeGames: freeGamesCountFromGameHistory,
        freeGamesUpdatedAt: startTime,
      });
      playedFreeGames = freeGamesCountFromGameHistory;
    }

    const freeGamesCount = playedFreeGames || 0;
    const freeGamesLimit = this.remoteConfigService.getFreeGameDailyLimit();
    return freeGamesCount < freeGamesLimit
      ? freeGamesLimit - freeGamesCount
      : 0;
  }
}
