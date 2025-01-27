/* eslint-disable unicorn/prevent-abbreviations */
/* istanbul ignore file */

// This can be done in jest setupFiles hook
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.jest' });

import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Transport } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { INestApplication, InternalServerErrorException } from '@nestjs/common';

import { getServiceConfig } from '@lib/fabzen-common/configuration';
import { App } from '@lib/fabzen-common/types';

import { UserModule } from 'apps/user/src/user.module';
import { AuthModule } from 'apps/auth/src/auth.module';
import { NotificationModule } from 'apps/notification/src/notification.module';
import { RestApiModule } from 'apps/rest-api/src/rest-api.module';
import { PaymentModule } from 'apps/payment/src/payment.module';
import { WalletModule } from 'apps/wallet/src/wallet.module';
import {
  Payment,
  PaymentDocument,
  Auth,
  AuthDocument,
  User,
  UserDocument,
  CounterDocument,
  Counter,
  Transaction,
  TransactionDocument,
  GameHistory,
  GameHistoryDocument,
} from '../mongoose/models';
import { SchedulerModule } from 'apps/scheduler/src/scheduler.module';
import { PromoModule } from 'apps/promo/src/promo.module';
import { GameRecordModule } from 'apps/game-record/src/game-record.module';

export class E2EServiceManager {
  private readonly mongoUri: string;
  private notificationService: INestApplication;
  private userService: INestApplication;
  private authService: INestApplication;
  private paymentService: INestApplication;
  private restApiService: INestApplication;
  private walletService: INestApplication;
  private gameRecordService: INestApplication;
  private promoService: INestApplication;
  private schedulerService: INestApplication;
  private isAllServicesReady: boolean;

  public authModel: Model<AuthDocument>;
  public userModel: Model<UserDocument>;
  public historyModel: Model<GameHistoryDocument>;
  public userCounterModel: Model<CounterDocument>;
  public paymentModel: Model<PaymentDocument>;
  public transactionModel: Model<TransactionDocument>;

  constructor(mongoUri: string) {
    this.mongoUri = mongoUri;
  }

  async setupServices() {
    await Promise.all([
      this.#setupNotificationService(),
      this.#setupUserService(),
      this.#setupAuthService(),
      this.#setupPaymentService(),
      this.#setupWalletService(),
      this.#setupRestApiService(),
      this.#setupSchedulerService(),
      this.#setupPromoService(),
      this.#setupGameRecordService(),
    ]);

    this.isAllServicesReady = true;
  }

  getHttpServer() {
    if (this.isAllServicesReady) {
      return this.restApiService.getHttpServer();
    } else {
      throw new InternalServerErrorException('Services are not ready');
    }
  }

  async cleanup() {
    await this.restApiService.close();
    await this.authService.close();
    await this.userService.close();
    await this.paymentService.close();
    await this.walletService.close();
    await this.schedulerService.close();
    await this.notificationService.close();
    await this.promoService.close();
    await this.gameRecordService.close();
  }

  async #setupNotificationService(): Promise<INestApplication> {
    const notificationModule = await Test.createTestingModule({
      imports: [NotificationModule.forRoot(this.mongoUri)],
    }).compile();

    const notificationService = notificationModule.createNestApplication();
    notificationService.connectMicroservice({
      transport: Transport.TCP,
      options: getServiceConfig(App.notification),
    });
    await notificationService.startAllMicroservices();
    await notificationService.init();
    this.notificationService = notificationService;
    return notificationService;
  }

  async #setupUserService(): Promise<INestApplication> {
    const userModule = await Test.createTestingModule({
      imports: [UserModule.forRoot(this.mongoUri)],
    }).compile();
    this.userModel = userModule.get(getModelToken(User.name));
    this.userCounterModel = userModule.get(getModelToken(Counter.name));
    const userService = userModule.createNestApplication();
    userService.connectMicroservice({
      transport: Transport.TCP,
      options: getServiceConfig(App.user),
    });
    await userService.startAllMicroservices();
    await userService.init();
    this.userService = userService;
    return userService;
  }

  async #setupGameRecordService(): Promise<INestApplication> {
    const gameRecordModule = await Test.createTestingModule({
      imports: [GameRecordModule.forRoot(this.mongoUri)],
    }).compile();
    this.historyModel = gameRecordModule.get(getModelToken(GameHistory.name));
    const gameRecordService = gameRecordModule.createNestApplication();
    gameRecordService.connectMicroservice({
      transport: Transport.TCP,
      options: getServiceConfig(App.gameRecord),
    });
    await gameRecordService.startAllMicroservices();
    await gameRecordService.init();
    this.gameRecordService = gameRecordService;
    return gameRecordService;
  }

  async #setupPromoService(): Promise<INestApplication> {
    const promoModule = await Test.createTestingModule({
      imports: [PromoModule.forRoot(this.mongoUri)],
    }).compile();
    const promoService = promoModule.createNestApplication();
    promoService.connectMicroservice({
      transport: Transport.TCP,
      options: getServiceConfig(App.promo),
    });
    await promoService.startAllMicroservices();
    await promoService.init();
    this.promoService = promoService;
    return promoService;
  }

  async #setupAuthService(): Promise<INestApplication> {
    const authModule = await Test.createTestingModule({
      imports: [AuthModule.forRoot(this.mongoUri)],
    }).compile();
    this.authModel = authModule.get(getModelToken(Auth.name));

    const authService = authModule.createNestApplication();
    authService.connectMicroservice({
      transport: Transport.TCP,
      options: getServiceConfig(App.auth),
    });

    await authService.startAllMicroservices();
    await authService.init();
    this.authService = authService;
    return authService;
  }

  async #setupPaymentService(): Promise<INestApplication> {
    const paymentModule = await Test.createTestingModule({
      imports: [PaymentModule.forRoot(this.mongoUri)],
    }).compile();
    this.paymentModel = paymentModule.get(getModelToken(Payment.name));

    const paymentService = paymentModule.createNestApplication();
    paymentService.connectMicroservice({
      transport: Transport.TCP,
      options: getServiceConfig(App.payment),
    });

    await paymentService.startAllMicroservices();
    await paymentService.init();
    this.paymentService = paymentService;
    return paymentService;
  }

  async #setupRestApiService(): Promise<INestApplication> {
    const restApiModule = await Test.createTestingModule({
      imports: [RestApiModule.forRoot(this.mongoUri)],
    }).compile();

    const restApiService = restApiModule.createNestApplication();
    await restApiService.init();
    this.restApiService = restApiService;
    return restApiService;
  }

  async #setupWalletService(): Promise<INestApplication> {
    const walletModule = await Test.createTestingModule({
      imports: [WalletModule.forRoot(this.mongoUri)],
    }).compile();
    this.transactionModel = walletModule.get(getModelToken(Transaction.name));
    const walletService = walletModule.createNestApplication();
    walletService.connectMicroservice({
      transport: Transport.TCP,
      options: getServiceConfig(App.wallet),
    });
    await walletService.startAllMicroservices();
    await walletService.init();
    this.walletService = walletService;
    return walletService;
  }

  async #setupSchedulerService(): Promise<INestApplication> {
    const schedulerModule = await Test.createTestingModule({
      imports: [SchedulerModule.forRoot(this.mongoUri)],
    }).compile();
    const schedulerService = schedulerModule.createNestApplication();
    schedulerService.connectMicroservice({
      transport: Transport.TCP,
      options: getServiceConfig(App.scheduler),
    });
    await schedulerService.startAllMicroservices();
    await schedulerService.init();
    this.schedulerService = schedulerService;
    return schedulerService;
  }
}
