import { APP_GUARD, APP_PIPE, RouterModule } from '@nestjs/core';
import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';

import { EnvironmentModule } from '@lib/fabzen-common/environment/environment.module';
import { App } from '@lib/fabzen-common/types';
import { FbzBaseHttpController } from '@lib/fabzen-common/utils/base-controller';
import { getServicesInfoToConnect } from '@lib/fabzen-common/configuration';

import { PaymentModule } from './subroutes/payment/payment.module';
import { DepositModule } from './subroutes/payment/deposit/deposit.module';
import { UsersModule } from './subroutes/user/users.module';
import { AuthModule } from './subroutes/auth/auth.module';
import { JwtStrategy } from './guards/strategies/jwt.strategy';
import { PayoutModule } from './subroutes/payment/payout/payout.module';
import { ReferralModule } from './subroutes/promo/referral/referral.module';
import { PromoModule } from './subroutes/promo/promo.module';
import { TransactionModule } from './subroutes/transaction/transaction.module';
import { MongooseModule } from '@lib/fabzen-common/mongoose/mongoose.module';
import { RemoteConfigModule } from '@lib/fabzen-common/remote-config/remote-config.module';
import { JwtGuard } from './guards/jwt.guard';
import { MaintenanceGuard } from './guards/maintenance.guard';
import { BlockUserGuard } from './guards/blocked-user.guard';
import { HistoryModule } from './subroutes/history/history.module';
import { CouponModule } from './subroutes/promo/coupon/coupon.module';
import { LudoModule } from './subroutes/ludo/ludo.module';
import { LudoTournamentModule } from './subroutes/ludo/tournament/tournament.module';
import { AdminModule } from './subroutes/admin/admin.module';
import { LudoMegaTournamentModule } from './subroutes/ludo/mega-tournament/mega-tournament.module';
import { AviatorModule } from './subroutes/aviator/aviator.module';

@Module({})
export class RestApiModule {
  static forRoot(mongoUri: string): DynamicModule {
    return {
      module: RestApiModule,
      imports: [
        EnvironmentModule,
        AuthModule,
        UsersModule.forRoot(mongoUri),
        PaymentModule,
        HistoryModule,
        DepositModule,
        PayoutModule.forRoot(mongoUri),
        ReferralModule,
        CouponModule,
        MongooseModule.forRoot(mongoUri),
        TransactionModule.forRoot(mongoUri),
        LudoModule,
        LudoTournamentModule,
        LudoMegaTournamentModule,
        AviatorModule.forRoot(mongoUri),
        AdminModule.forRoot(mongoUri),
        RouterModule.register([
          {
            path: '/auth',
            module: AuthModule,
          },
          {
            path: '/users',
            module: UsersModule,
          },
          {
            path: '/admin',
            module: AdminModule,
          },
          {
            path: '/promo',
            module: PromoModule,
            children: [
              {
                path: '/referral',
                module: ReferralModule,
              },
              {
                path: '/coupon',
                module: CouponModule,
              },
            ],
          },
          {
            path: '/payment',
            module: PaymentModule,
            children: [
              {
                path: '/deposit',
                module: DepositModule,
              },
              {
                path: '/payout',
                module: PayoutModule,
              },
            ],
          },
          {
            path: '/history',
            module: HistoryModule,
          },
          {
            path: '/transactions',
            module: TransactionModule,
          },
          {
            path: '/ludo',
            module: LudoModule,
            children: [
              {
                path: '/tournament',
                module: LudoTournamentModule,
              },
              {
                path: '/mega-tournament',
                module: LudoMegaTournamentModule,
              },
            ],
          },
          {
            path: '/aviator',
            module: AviatorModule,
          },
        ]),
        ClientsModule.register({
          clients: getServicesInfoToConnect(App.restApi),
          isGlobal: true,
        }),
        RemoteConfigModule,
      ],
      providers: [
        JwtService,
        JwtStrategy,
        {
          provide: APP_PIPE,
          useValue: new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
          }),
        },
        {
          provide: APP_GUARD,
          useClass: JwtGuard,
        },
        {
          provide: APP_GUARD,
          useClass: MaintenanceGuard,
        },
        {
          provide: APP_GUARD,
          useClass: BlockUserGuard,
        },
      ],
      controllers: [FbzBaseHttpController],
    };
  }
}
