import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule as NestMongooseModule } from '@nestjs/mongoose';

import {
  Payment,
  PaymentSchema,
  Counter,
  CounterSchema,
  User,
  UserSchema,
  Auth,
  AuthSchema,
  SpRoundHistory,
  SpRoundHistorySchema,
  ReRoundHistory,
  ReRoundHistorySchema,
  GameHistory,
  GameHistorySchema,
  Transaction,
  TransactionSchema,
  Coupon,
  CouponSchema,
  CouponUser,
  CouponUserSchema,
  ConversionRate,
  ConversionRateSchema,
  Tournament,
  TournamentSchema,
  TournamentPlayerSchema,
  LudoMegaTournament,
  LudoMegaTournamentSchema,
  LudoTournament,
  LudoTournamentSchema,
  LudoTournamentPlayer,
  LudoTournamentPlayerSchema,
  LudoTournamentLeaderboard,
  LudoTournamentLeaderboardSchema,
  Leaderboard,
  LeaderboardSchema,
  TournamentPlayer,
  LudoMegaTournamentPlayer,
  LudoMegaTournamentPlayerSchema,
  AviatorRoundHistory,
  AviatorRoundHistorySchema,
} from './models';
import {
  MongooseSpGameHistoryRepository,
  MongooseReGameHistoryRepository,
  MongooseCbrGameHistoryRepository,
  MongooseLudoTournamentRepository,
  MongooseLudoGameHistoryRepository,
  MongooseLudoMegaTournamentRepository,
  MongooseAuthRepository,
  MongoosePaymentRepository,
  MongooseUserRepository,
  MongooseWalletRepository,
  MongoosePromoRepository,
  MongooseSLGameRepository,
  MongooseAviatorHistoryRepository,
} from './repositories';
import { SpGameHistoryRepository } from 'apps/sp-gameplay/src/sp-gameplay.respository';
import { ReGameHistoryRepository } from 'apps/re-gameplay/src/re-gameplay.repository';
import { CbrGameHistoryRepository } from 'apps/cbr-gameplay/src/cbr-gameplay.repository';
import { PromoRepository } from 'apps/promo/src/domain/interfaces';
import { LudoMegaTournamentRepository } from 'apps/ludo-mega-tournament/src/domain/interfaces';
import { AuthRepository } from 'apps/auth/src/domain/interfaces/auth.repository';
import { PaymentRepository } from 'apps/payment/src/domain/interfaces';
import { UserRepository } from 'apps/user/src/domain/interfaces';
import { WalletRepository } from 'apps/wallet/src/domain/interfaces';
import { RemoteConfigModule } from '../remote-config/remote-config.module';
import { SLGameMongooseRepository } from 'apps/sl-gameplay/src/domain/interfaces';
import { AviatorHistoryRepository } from 'apps/aviator-gameplay/src/domain/interfaces';
import {
  PayoutAccount,
  PayoutAccountSchema,
} from './models/payout-accounts.schema';

@Module({})
export class MongooseModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: MongooseModule,
      imports: [
        NestMongooseModule.forRoot(mongoUri),
        NestMongooseModule.forFeature([
          { name: Auth.name, schema: AuthSchema },
          { name: Payment.name, schema: PaymentSchema },
          { name: PayoutAccount.name, schema: PayoutAccountSchema },
          { name: User.name, schema: UserSchema },
          { name: Counter.name, schema: CounterSchema },
          { name: Transaction.name, schema: TransactionSchema },
          { name: ConversionRate.name, schema: ConversionRateSchema },
          { name: Leaderboard.name, schema: LeaderboardSchema },
          { name: GameHistory.name, schema: GameHistorySchema },
          { name: Coupon.name, schema: CouponSchema },
          { name: CouponUser.name, schema: CouponUserSchema },
          { name: SpRoundHistory.name, schema: SpRoundHistorySchema },
          { name: ReRoundHistory.name, schema: ReRoundHistorySchema },
          { name: AviatorRoundHistory.name, schema: AviatorRoundHistorySchema },
          { name: ReRoundHistory.name, schema: ReRoundHistorySchema },
          { name: LudoTournament.name, schema: LudoTournamentSchema },
          {
            name: LudoTournamentPlayer.name,
            schema: LudoTournamentPlayerSchema,
          },
          {
            name: LudoTournamentLeaderboard.name,
            schema: LudoTournamentLeaderboardSchema,
          },
          {
            name: Tournament.name,
            schema: TournamentSchema,
            discriminators: [
              {
                name: LudoMegaTournament.name,
                schema: LudoMegaTournamentSchema,
              },
            ],
          },
          {
            name: TournamentPlayer.name,
            schema: TournamentPlayerSchema,
            discriminators: [
              {
                name: LudoMegaTournamentPlayer.name,
                schema: LudoMegaTournamentPlayerSchema,
              },
            ],
          },
        ]),
        RemoteConfigModule,
      ],
      providers: [
        NestMongooseModule,

        {
          provide: AuthRepository,
          useClass: MongooseAuthRepository,
        },
        {
          provide: UserRepository,
          useClass: MongooseUserRepository,
        },
        {
          provide: PaymentRepository,
          useClass: MongoosePaymentRepository,
        },
        {
          provide: WalletRepository,
          useClass: MongooseWalletRepository,
        },
        {
          provide: SpGameHistoryRepository,
          useClass: MongooseSpGameHistoryRepository,
        },
        {
          provide: ReGameHistoryRepository,
          useClass: MongooseReGameHistoryRepository,
        },
        {
          provide: AviatorHistoryRepository,
          useClass: MongooseAviatorHistoryRepository,
        },
        {
          provide: ReGameHistoryRepository,
          useClass: MongooseReGameHistoryRepository,
        },
        {
          provide: PromoRepository,
          useClass: MongoosePromoRepository,
        },
        {
          provide: CbrGameHistoryRepository,
          useClass: MongooseCbrGameHistoryRepository,
        },
        MongooseLudoTournamentRepository,
        MongooseLudoGameHistoryRepository,
        {
          provide: LudoMegaTournamentRepository,
          useClass: MongooseLudoMegaTournamentRepository,
        },
        {
          provide: SLGameMongooseRepository,
          useClass: MongooseSLGameRepository,
        },
      ],
      exports: [
        NestMongooseModule,
        AuthRepository,
        NestMongooseModule,
        UserRepository,
        PaymentRepository,
        WalletRepository,
        PromoRepository,
        SpGameHistoryRepository,
        ReGameHistoryRepository,
        CbrGameHistoryRepository,
        MongooseLudoTournamentRepository,
        MongooseLudoGameHistoryRepository,
        AviatorHistoryRepository,
        LudoMegaTournamentRepository,
        SLGameMongooseRepository,
      ],
    };
  }
}
