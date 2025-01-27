/* istanbul ignore file */

import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { InternalServerErrorException, applyDecorators } from '@nestjs/common';

import { FbzLogger } from '../utils/logger.util';
import { App, Environment } from '../types';
import { camelCaseToParameterCase } from '../utils/string.utils';

const logger: FbzLogger = new FbzLogger('Configuration');

export class EnvironmentVariables {
  @IsEnum(App)
  APP_NAME: App;

  @IsNotEmpty()
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @RequiredApps([
    App.restApi,
    App.socketGateway,
    App.cbrGameplay,
    App.reGameplay,
    App.spGameplay,
    App.ludoGameplay,
    App.slGameplay,
    App.eplGameplay,
  ])
  @IsNotEmpty()
  @IsString()
  MAINTENANCE_BYPASS_KEY: string;

  @RequiredApps([
    App.auth,
    App.socketGateway,
    App.cbrGameplay,
    App.reGameplay,
    App.spGameplay,
    App.slGameplay,
    App.eplGameplay,
  ])
  @IsNotEmpty()
  @IsString()
  JWT_EXPIRATION: string;

  @RequiredApps([
    App.restApi,
    App.socketGateway,
    App.cbrGameplay,
    App.reGameplay,
    App.spGameplay,
    App.ludoGameplay,
    App.slGameplay,
    App.eplGameplay,
    App.ludoMegaTournament,
    App.aviator,
  ])
  @IsNotEmpty()
  @IsString()
  JWT_PUBLIC_KEY: string;

  @RequiredApps([App.auth])
  @IsNotEmpty()
  @IsString()
  JWT_PRIVATE_KEY: string;

  @RequiredApps([
    App.restApi,
    App.socketGateway,
    App.cbrGameplay,
    App.reGameplay,
    App.spGameplay,
    App.ludoMegaTournament,
    App.slGameplay,
    App.eplGameplay,
    App.ludoGameplay,
    App.aviator,
  ])
  @IsNotEmpty()
  @CustomIsBoolean()
  JWT_IGNORE_EXPIRATION: boolean;

  @RequiredApps([
    App.restApi,
    App.auth,
    App.payment,
    App.reGameplay,
    App.spGameplay,
    App.eplGameplay,
    App.cbrGameplay,
    App.aviator,
  ])
  @IsNotEmpty()
  @IsString()
  USER_SERVICE_HOST: string;

  @RequiredApps([
    App.user,
    App.auth,
    App.restApi,
    App.payment,
    App.reGameplay,
    App.spGameplay,
    App.cbrGameplay,
    App.aviator,
  ])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  USER_SERVICE_PORT: number;

  @RequiredApps([App.restApi, App.scheduler])
  @IsNotEmpty()
  @IsString()
  RECORD_SERVICE_HOST: string;

  @RequiredApps([App.restApi, App.gameRecord, App.scheduler])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  RECORD_SERVICE_PORT: number;

  @RequiredApps([
    App.cbrGameplay,
    App.scheduler,
    App.socketGateway,
    App.restApi,
  ])
  @IsNotEmpty()
  @IsString()
  CBR_GAMEPLAY_SERVICE_HOST: string;

  @RequiredApps([
    App.cbrGameplay,
    App.scheduler,
    App.socketGateway,
    App.restApi,
  ])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  CBR_GAMEPLAY_SERVICE_PORT: number;

  @RequiredApps([App.cbrGameplay])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  CBR_GAMEPLAY_SERVICE_PUBLIC_PORT: number;

  @RequiredApps([App.restApi])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  REST_API_SERVICE_PORT: number;

  @IsNotEmpty()
  @IsString()
  AWS_ACCESS_KEY_ID: string;

  @IsNotEmpty()
  @IsString()
  AWS_SECRET_ACCESS_KEY: string;

  @IsNotEmpty()
  @IsString()
  AWS_REGION: string;

  @RequiredApps([App.restApi, App.user, App.verification, App.payment])
  @IsNotEmpty()
  @IsString()
  AWS_S3_BUCKET_PREFIX: string;

  @RequiredApps([App.auth, App.restApi])
  @IsNotEmpty()
  @IsString()
  AUTH_SERVICE_HOST: string;

  @RequiredApps([App.auth, App.restApi])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  AUTH_SERVICE_PORT: number;

  @RequiredApps([App.promo, App.restApi])
  @IsNotEmpty()
  @IsString()
  PROMO_SERVICE_HOST: string;

  @RequiredApps([App.promo, App.restApi])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  PROMO_SERVICE_PORT: number;

  @RequiredApps([App.auth])
  @IsNotEmpty()
  @IsString()
  IP_API_SERVICE_API_KEY: string;

  @IsNotEmpty()
  @IsString()
  CONFIG_FILE_URL: string;

  @IsNotEmpty()
  @IsString()
  MONGODB_URI: string;

  @RequiredApps([App.user])
  @IsNotEmpty()
  @IsString()
  SUREPASS_AUTHORIZATION_TOKEN: string;

  @RequiredApps([App.user])
  @IsNotEmpty()
  @IsString()
  SUREPASS_BASE_URL: string;

  @RequiredApps([App.payment, App.restApi])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  PAYMENT_SERVICE_PORT: number;

  @RequiredApps([App.restApi])
  @IsNotEmpty()
  @IsString()
  PAYMENT_SERVICE_HOST: string;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsUrl()
  CASHFREE_BASE_URL: string;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsString()
  CASHFREE_DEPOSIT_CLIENT_ID: string;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsString()
  CASHFREE_DEPOSIT_CLIENT_SECRET: string;

  @RequiredApps([
    App.auth,
    App.scheduler,
    App.payment,
    App.user,
    App.ludoGameplay,
    App.spGameplay,
    App.cbrGameplay,
    App.ludoMegaTournament,
    App.slGameplay,
  ])
  @IsNotEmpty()
  @IsString()
  NOTIFICATION_SERVICE_HOST: string;

  @RequiredApps([
    App.notification,
    App.auth,
    App.scheduler,
    App.payment,
    App.user,
    App.ludoGameplay,
    App.spGameplay,
    App.cbrGameplay,
    App.ludoMegaTournament,
    App.slGameplay,
  ])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  NOTIFICATION_SERVICE_PORT: number;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  MSG91_GLOBAL_PLAYSTORE_TEMPLATE_ID: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  MSG91_GLOBAL_WEBSITE_TEMPLATE_ID: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  MSG91_LOCAL_PLAYSTORE_TEMPLATE_ID: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  MSG91_LOCAL_WEBSITE_TEMPLATE_ID: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  MSG91_DOWNLOAD_SMS_TEMPLATE_ID: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  MSG91_AUTH_KEY: string;

  @RequiredApps([
    App.wallet,
    App.payment,
    App.restApi,
    App.user,
    App.reGameplay,
    App.spGameplay,
    App.cbrGameplay,
    App.ludoGameplay,
    App.ludoTournament,
    App.ludoMegaTournament,
    App.slGameplay,
    App.eplGameplay,
    App.aviator,
  ])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  WALLET_SERVICE_PORT: number;

  @RequiredApps([
    App.payment,
    App.restApi,
    App.user,
    App.reGameplay,
    App.spGameplay,
    App.cbrGameplay,
    App.ludoGameplay,
    App.ludoTournament,
    App.ludoMegaTournament,
    App.slGameplay,
    App.eplGameplay,
    App.aviator,
  ])
  @IsNotEmpty()
  @IsString()
  WALLET_SERVICE_HOST: string;

  @RequiredApps([
    App.scheduler,
    App.reGameplay,
    App.spGameplay,
    App.notification,
    App.ludoGameplay,
    App.cbrGameplay,
    App.slGameplay,
  ])
  @IsNotEmpty()
  @IsString()
  SOCKET_GATEWAY_HOST: string;

  @RequiredApps([
    App.socketGateway,
    App.reGameplay,
    App.spGameplay,
    App.scheduler,
    App.notification,
    App.ludoGameplay,
    App.cbrGameplay,
    App.slGameplay,
  ])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  SOCKET_GATEWAY_PORT: number;

  @RequiredApps([App.socketGateway])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  SOCKET_GATEWAY_PUBLIC_PORT: number;

  @RequiredApps([App.spGameplay, App.socketGateway, App.scheduler, App.restApi])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  SP_GAMEPLAY_SERVICE_PORT: number;

  @RequiredApps([App.socketGateway, App.scheduler, App.restApi])
  @IsNotEmpty()
  @IsString()
  SP_GAMEPLAY_SERVICE_HOST: string;

  @RequiredApps([App.spGameplay])
  @IsNotEmpty()
  @IsString()
  SP_GAMEPLAY_SERVICE_PUBLIC_PORT: string;

  @RequiredApps([App.reGameplay, App.socketGateway, App.scheduler, App.restApi])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  RE_GAMEPLAY_SERVICE_PORT: number;

  @RequiredApps([App.socketGateway, App.scheduler, App.restApi])
  @IsNotEmpty()
  @IsString()
  RE_GAMEPLAY_SERVICE_HOST: string;

  @RequiredApps([App.reGameplay])
  @IsNotEmpty()
  @IsString()
  RE_GAMEPLAY_SERVICE_PUBLIC_PORT: string;

  @RequiredApps([
    App.socketGateway,
    App.cbrGameplay,
    App.reGameplay,
    App.spGameplay,
    App.ludoGameplay,
    App.ludoMegaTournament,
    App.slGameplay,
    App.eplGameplay,
    App.aviator,
  ])
  @IsNotEmpty()
  @IsString()
  REDIS_ADAPTER_HOST: string;

  @RequiredApps([
    App.socketGateway,
    App.cbrGameplay,
    App.reGameplay,
    App.spGameplay,
    App.ludoGameplay,
    App.ludoMegaTournament,
    App.slGameplay,
    App.eplGameplay,
    App.aviator,
  ])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  REDIS_ADAPTER_PORT: number;

  @RequiredApps([
    App.socketGateway,
    App.cbrGameplay,
    App.reGameplay,
    App.ludoGameplay,
    App.ludoMegaTournament,
    App.slGameplay,
    App.eplGameplay,
    App.aviator,
  ])
  @IsNotEmpty()
  @CustomIsBoolean()
  REDIS_ADAPTER_IS_CLUSTERED: boolean;

  @RequiredApps([
    App.ludoGameplay,
    App.socketGateway,
    App.scheduler,
    App.ludoTournament,
  ])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  LUDO_GAMEPLAY_SERVICE_PORT: number;

  @RequiredApps([App.socketGateway, App.scheduler, App.ludoTournament])
  @IsNotEmpty()
  @IsString()
  LUDO_GAMEPLAY_SERVICE_HOST: string;

  @RequiredApps([App.ludoGameplay])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  LUDO_GAMEPLAY_SERVICE_PUBLIC_PORT: number;

  @RequiredApps([App.spGameplay, App.socketGateway])
  @IsNotEmpty()
  @IsString()
  SP_REDIS_HOST: string;

  @RequiredApps([App.spGameplay, App.socketGateway])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  SP_REDIS_PORT: number;

  @RequiredApps([App.reGameplay, App.socketGateway])
  @IsNotEmpty()
  @IsString()
  RE_REDIS_HOST: string;

  @RequiredApps([App.reGameplay, App.socketGateway])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  RE_REDIS_PORT: number;

  @RequiredApps([App.cbrGameplay, App.socketGateway])
  @IsNotEmpty()
  @IsString()
  CBR_REDIS_HOST: string;

  @RequiredApps([App.cbrGameplay])
  @IsNotEmpty()
  @IsString()
  CBR_TABLE_PREFIX: string;

  @RequiredApps([App.cbrGameplay, App.socketGateway])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  CBR_REDIS_PORT: number;

  @RequiredApps([App.cbrGameplay, App.socketGateway])
  @IsNotEmpty()
  @CustomIsBoolean()
  CBR_REDIS_IS_CLUSTERED: boolean;

  @RequiredApps([App.cbrGameplay, App.socketGateway])
  @IsNotEmpty()
  @CustomIsBoolean()
  CBR_REDIS_TLS_ENABLED: boolean;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsString()
  CASHFREE_PAYOUT_CLIENT_ID: string;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsString()
  CASHFREE_PAYOUT_CLIENT_SECRET: string;

  @RequiredApps([
    App.socketGateway,
    App.scheduler,
    App.ludoGameplay,
    App.ludoTournament,
  ])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  SCHEDULER_SERVICE_PORT: number;

  @RequiredApps([App.socketGateway, App.ludoGameplay, App.ludoTournament])
  @IsNotEmpty()
  @IsString()
  SCHEDULER_SERVICE_HOST: string;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsUrl()
  JUSPAY_BASE_URL: string;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsString()
  JUSPAY_DEPOSIT_API_KEY: string;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsString()
  JUSPAY_MERCHANT_ID: string;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsString()
  JUSPAY_CLIENT_ID: string;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsString()
  JUSPAY_PAYOUT_API_KEY: string;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsString()
  REST_API_BASE_URL: string;

  @RequiredApps([App.ludoGameplay, App.ludoTournament, App.socketGateway])
  @IsNotEmpty()
  @IsString()
  LUDO_REDIS_HOST: string;

  @RequiredApps([App.ludoGameplay, App.ludoTournament, App.socketGateway])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  LUDO_REDIS_PORT: number;

  @RequiredApps([App.ludoGameplay, App.ludoTournament, App.socketGateway])
  @IsNotEmpty()
  @CustomIsBoolean()
  LUDO_REDIS_IS_CLUSTERED: boolean;

  @RequiredApps([App.ludoGameplay, App.ludoTournament, App.socketGateway])
  @IsNotEmpty()
  @CustomIsBoolean()
  LUDO_REDIS_IS_TLS_ENABLED: boolean;

  @RequiredApps([App.scheduler, App.restApi, App.ludoGameplay])
  @IsNotEmpty()
  @IsString()
  LUDO_TOURNAMENT_SERVICE_HOST: string;

  @RequiredApps([
    App.ludoTournament,
    App.scheduler,
    App.restApi,
    App.ludoGameplay,
  ])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  LUDO_TOURNAMENT_SERVICE_PORT: number;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  LUDO_TOURNAMENT_CUSTOM_CHANNEL_ID: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  LUDO_TOURNAMENT_DEFAULT_SOUND_ID: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  LUDO_TOURNAMENT_IOS_SOUND_ID: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  NORMAL_PN_CUSTOM_CHANNEL_ID: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  NORMAL_PN_IOS_SOUND_ID: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  ONE_SIGNAL_APP_ID: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  ONE_SIGNAL_AUTH_TOKEN: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  ONE_SIGNAL_BASE_URL: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  PLAYSTORE_PACKAGE_NAME: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  WEBSITE_PACKAGE_NAME: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  APPSFLYER_PLAYSTORE_DEV_KEY: string;

  @RequiredApps([App.notification])
  @IsNotEmpty()
  @IsString()
  APPSFLYER_PRO_DEV_KEY: string;

  @RequiredApps([App.ludoTournament])
  @IsNotEmpty()
  @IsString()
  FIREBASE_APP_ID: string;

  @RequiredApps([App.payment])
  @IsNotEmpty()
  @IsString()
  INVOICE_CLOUDFRONT_URL: string;

  @RequiredApps([App.socketGateway, App.restApi])
  @IsNotEmpty()
  @IsString()
  SL_GAMEPLAY_SERVICE_HOST: string;

  @RequiredApps([App.slGameplay, App.socketGateway, App.restApi])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  SL_GAMEPLAY_SERVICE_PORT: number;

  @RequiredApps([App.slGameplay])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  SL_GAMEPLAY_SERVICE_PUBLIC_PORT: number;

  @RequiredApps([App.slGameplay])
  @IsNotEmpty()
  @IsString()
  SL_GAMEPLAY_REDIS_HOST: string;

  @RequiredApps([App.slGameplay])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  SL_GAMEPLAY_REDIS_PORT: number;

  @RequiredApps([App.slGameplay])
  @IsNotEmpty()
  @CustomIsBoolean()
  SL_GAMEPLAY_REDIS_IS_CLUSTERED: boolean;

  @RequiredApps([App.slGameplay])
  @IsNotEmpty()
  @CustomIsBoolean()
  SL_GAMEPLAY_REDIS_TLS_ENABLED: boolean;

  @RequiredApps([App.socketGateway])
  @IsNotEmpty()
  @IsString()
  EPL_GAMEPLAY_SERVICE_HOST: string;

  @RequiredApps([App.eplGameplay, App.socketGateway])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  EPL_GAMEPLAY_SERVICE_PORT: number;

  @RequiredApps([App.eplGameplay])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  EPL_GAMEPLAY_SERVICE_PUBLIC_PORT: number;

  @RequiredApps([App.eplGameplay])
  @IsNotEmpty()
  @IsString()
  EPL_GAMEPLAY_REDIS_HOST: string;

  @RequiredApps([App.eplGameplay])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  EPL_GAMEPLAY_REDIS_PORT: number;

  @RequiredApps([App.eplGameplay])
  @IsNotEmpty()
  @CustomIsBoolean()
  EPL_GAMEPLAY_REDIS_IS_CLUSTERED: boolean;

  @RequiredApps([App.eplGameplay])
  @IsNotEmpty()
  @CustomIsBoolean()
  EPL_GAMEPLAY_REDIS_TLS_ENABLED: boolean;

  @RequiredApps([App.restApi, App.socketGateway])
  @IsNotEmpty()
  @IsString()
  LUDO_MEGA_TOURNAMENT_SERVICE_HOST: string;

  @RequiredApps([App.ludoMegaTournament, App.restApi, App.socketGateway])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  LUDO_MEGA_TOURNAMENT_SERVICE_PORT: number;

  @RequiredApps([App.ludoMegaTournament])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  LUDO_MEGA_TOURNAMENT_SERVICE_PUBLIC_PORT: number;

  @RequiredApps([App.ludoMegaTournament])
  @IsNotEmpty()
  @IsString()
  LUDO_MEGA_TOURNAMENT_REDIS_HOST: string;

  @RequiredApps([App.ludoMegaTournament])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  LUDO_MEGA_TOURNAMENT_REDIS_PORT: number;

  @RequiredApps([App.ludoMegaTournament])
  @IsNotEmpty()
  @CustomIsBoolean()
  LUDO_MEGA_TOURNAMENT_REDIS_IS_CLUSTERED: boolean;

  @RequiredApps([App.ludoMegaTournament])
  @IsNotEmpty()
  @CustomIsBoolean()
  LUDO_MEGA_TOURNAMENT_REDIS_IS_TLS_ENABLED: boolean;

  @RequiredApps([App.aviator])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  AVIATOR_GAMEPLAY_SERVICE_PUBLIC_PORT: number;

  @RequiredApps([App.aviator, App.socketGateway])
  @IsNotEmpty()
  @IsString()
  AVIATOR_GAMEPLAY_SERVICE_HOST: string;

  @RequiredApps([App.aviator, App.socketGateway])
  @IsNotEmpty()
  @IsNumber()
  @Min(1024)
  @Max(65_535)
  AVIATOR_GAMEPLAY_SERVICE_PORT: number;

  @RequiredApps([App.aviator])
  @IsNotEmpty()
  @IsString()
  AVIATOR_REDIS_HOST: string;

  @RequiredApps([App.aviator])
  @IsNotEmpty()
  @Min(1024)
  @Max(65_535)
  AVIATOR_REDIS_PORT: number;

  @RequiredApps([App.aviator])
  @IsNotEmpty()
  @CustomIsBoolean()
  AVIATOR_REDIS_IS_CLUSTERED: boolean;

  @RequiredApps([App.aviator])
  @IsNotEmpty()
  @CustomIsBoolean()
  AVIATOR_REDIS_IS_TLS_ENABLED: boolean;

  @RequiredApps([App.payment, App.auth])
  @IsNotEmpty()
  @IsString()
  META_ACCESS_TOKEN: string;

  @RequiredApps([App.payment, App.auth])
  @IsNotEmpty()
  @IsString()
  META_APP_ID: string;

  @RequiredApps([App.payment, App.auth])
  @IsNotEmpty()
  @IsString()
  META_WEBSITE_URL: string;

  constructor() {
    this.APP_NAME = getRunningAppName();
  }
}

function RequiredApps(apps: App[]) {
  return function (target: any, propertyKey: any) {
    apps.push(App.jest);
    ValidateIf(({ APP_NAME }) => {
      return apps.includes(APP_NAME);
    })(target, propertyKey);
    return Transform((parameters: TransformFnParams) => {
      const { value } = parameters;
      return apps.includes(getRunningAppName()) ? value : '';
    })(target, propertyKey);
  };
}

export const getRunningAppName = (): App => {
  if (process.env.NODE_ENV === Environment.jest) {
    return App.jest;
  } else {
    const appNameFromProcess = Object.keys(App).find((appName: string) =>
      process.argv[1].includes(camelCaseToParameterCase(appName)),
    ) as string;
    const availableAppNames = Object.values(App) as string[];

    if (availableAppNames.includes(appNameFromProcess)) {
      return appNameFromProcess as App;
    } else {
      const errorMessage = `Unknow App Name ${appNameFromProcess}
      Expect one of the following names
      ${availableAppNames}`;
      logger.fatal(errorMessage);
      throw new InternalServerErrorException(errorMessage);
    }
  }
};

function CustomIsBoolean() {
  return applyDecorators(
    IsBoolean(),
    Transform(({ obj, key }) => {
      return [true, 'enabled', 'true'].includes(obj[key]);
    }),
  );
}
