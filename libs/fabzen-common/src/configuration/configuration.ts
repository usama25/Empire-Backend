/* istanbul ignore file */

import type { Algorithm } from 'jsonwebtoken';
import { plainToInstance } from 'class-transformer';
import { InternalServerErrorException } from '@nestjs/common';
import { ClientProviderOptions, Transport } from '@nestjs/microservices';

import {
  App,
  Environment,
  Gateway,
  ServiceConfig,
  ServiceInfo,
  TransporterProviders,
} from '../types';
import { FbzLogger } from '../utils/logger.util';
import { EnvironmentVariables } from '../environment/environment-spec';

const logger: FbzLogger = new FbzLogger('Configuration');

const parsedConfig = plainToInstance(EnvironmentVariables, process.env, {
  enableImplicitConversion: true,
});

const encodedApiKey =
  'Basic ' +
  Buffer.from(parsedConfig.JUSPAY_DEPOSIT_API_KEY + ':').toString('base64');
const encodedPayoutApiKey =
  'Basic ' +
  Buffer.from(parsedConfig.JUSPAY_PAYOUT_API_KEY + ':').toString('base64');

export const config = {
  env: parsedConfig.NODE_ENV,
  isDevelopment: [
    Environment.development,
    Environment.test,
    Environment.jest,
  ].includes(parsedConfig.NODE_ENV as Environment),
  isJest: [Environment.jest].includes(parsedConfig.NODE_ENV as Environment),
  isProduction: [Environment.production].includes(
    parsedConfig.NODE_ENV as Environment,
  ),
  isLocal: [Environment.development].includes(
    parsedConfig.NODE_ENV as Environment,
  ),
  aws: {
    accessKeyId: parsedConfig.AWS_ACCESS_KEY_ID,
    secretAccessKey: parsedConfig.AWS_SECRET_ACCESS_KEY,
    region: parsedConfig.AWS_REGION,
    s3: {
      s3BucketPrefix: parsedConfig.AWS_S3_BUCKET_PREFIX,
      s3KeyInvalidChars: /["#%*/:<>?[\\\]^`{|}~]/g,
      transporterS3Bucket: 'transporter-s3-bucket',
    },
    localstackEndpoints: {
      s3: 'http://localstack:4566',
    },
  },
  configFile: {
    url: parsedConfig.CONFIG_FILE_URL,
    configCacheTTLInSeconds: 5,
  },
  mongodb: {
    mongoUri: parsedConfig.MONGODB_URI,
  },
  meta: {
    eventSourceUrl: parsedConfig.META_WEBSITE_URL,
    accessToken: parsedConfig.META_ACCESS_TOKEN,
    pixelId: parsedConfig.META_APP_ID,
  },
  auth: {
    host: parsedConfig.AUTH_SERVICE_HOST,
    port: parsedConfig.AUTH_SERVICE_PORT,
    maintenanceBypassKey: parsedConfig.MAINTENANCE_BYPASS_KEY,
    jwt: {
      algorithm: 'ES256' as Algorithm,
      expiration: parsedConfig.JWT_EXPIRATION,
      publicKey: parsedConfig.JWT_PUBLIC_KEY,
      privateKey: parsedConfig.JWT_PRIVATE_KEY,
      ignoreExpiration: parsedConfig.JWT_IGNORE_EXPIRATION,
    },
    swagger: {
      username: 'fbz',
      password: '123456',
    },
    defaultCountryCode: '91',
    ipApiService: {
      baseUrl: 'http://pro.ip-api.com/json',
      apiKey: parsedConfig.IP_API_SERVICE_API_KEY,
    },
    otp: {
      length: 6,
      maxRetries: 100,
      sendTimeoutInMinutes: 1,
      devOtp: '123456',
      whilteList: {
        playstore: ['1525152515'],
        website: ['2024202420'],
      },

      expirationInMinutes: 10,
      continuousFailureLimit: 10,
    },
  },
  promo: {
    host: parsedConfig.PROMO_SERVICE_HOST,
    port: parsedConfig.PROMO_SERVICE_PORT,
  },
  restApi: {
    port: parsedConfig.REST_API_SERVICE_PORT,
    defaultParams: {
      skip: 0,
      limit: 10,
      sortBy: 'createdAt',
      sortDir: 1,
    },
  },
  record: {
    host: parsedConfig.RECORD_SERVICE_HOST,
    port: parsedConfig.RECORD_SERVICE_PORT,
  },
  user: {
    host: parsedConfig.USER_SERVICE_HOST,
    port: parsedConfig.USER_SERVICE_PORT,
    maxAvatarIndex: 11,
    referralCodeAlphabet: '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    initialUserCounter: 111_111_111,
    kycBucketName: 'kyc-bucket',
    surepass: {
      baseUrl: parsedConfig.SUREPASS_BASE_URL,
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${parsedConfig.SUREPASS_AUTHORIZATION_TOKEN}`,
      },
    },
  },
  payment: {
    host: parsedConfig.PAYMENT_SERVICE_HOST,
    port: parsedConfig.PAYMENT_SERVICE_PORT,
    defaultCurrency: 'INR',
    orderIdAlphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    invoiceCloudFrontUrl: parsedConfig.INVOICE_CLOUDFRONT_URL,
    invoiceBucket: 'invoices',
    cashfree: {
      deposit: {
        orderNote: 'Payment for Ludo Empire',
        fallbackName: 'ludo',
        urls: {
          baseUrl: parsedConfig.CASHFREE_BASE_URL,
          sessionUrl: parsedConfig.CASHFREE_BASE_URL + '/sessions',
          returnUrl: `https://ludoempire.com/cashfree/check-status/{order_id}`,
          notifyUrl: `${parsedConfig.REST_API_BASE_URL}/payment/deposit/webhook/cashfree`,
        },
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': '2022-09-01',
          'x-client-id': parsedConfig.CASHFREE_DEPOSIT_CLIENT_ID,
          'x-client-secret': parsedConfig.CASHFREE_DEPOSIT_CLIENT_SECRET,
        },
      },
      payout: {
        fallbackName: 'ludo',
        clientId: parsedConfig.CASHFREE_PAYOUT_CLIENT_ID,
        clientSecret: parsedConfig.CASHFREE_PAYOUT_CLIENT_SECRET,
        baseUrl:
          parsedConfig.NODE_ENV === Environment.production
            ? 'https://payout-api.cashfree.com/payout'
            : 'https://payout-gamma.cashfree.com/payout',
        env:
          parsedConfig.NODE_ENV === Environment.production
            ? 'PRODUCTION'
            : 'TEST',
        tdsPercentage: '0.3', // Input in decimal. ex: 30% = 0.3
      },
    },
    juspay: {
      deposit: {
        urls: {
          sessionUrl: `${parsedConfig.JUSPAY_BASE_URL}/session`,
          statusUrl: `${parsedConfig.JUSPAY_BASE_URL}/orders`,
          returnUrl: `${parsedConfig.REST_API_BASE_URL}/payment/deposit/webhook/cashfree`,
          webhookUrl: `${parsedConfig.REST_API_BASE_URL}/payment/deposit/webhook/juspay`,
          transactionApiUrl: `${parsedConfig.JUSPAY_BASE_URL}/txns`,
        },
        fallbackEmail: 'test@fabzentech.com',
        headers: {
          Authorization: encodedApiKey,
          'x-merchantid': parsedConfig.JUSPAY_MERCHANT_ID,
          'Content-Type': 'application/json',
        },
        apiKey: parsedConfig.JUSPAY_DEPOSIT_API_KEY,
        merchantId: parsedConfig.JUSPAY_MERCHANT_ID,
        clientId: parsedConfig.JUSPAY_CLIENT_ID,
        paymentPageDescription: 'Payment for Ludo Empire',
      },
      payout: {
        urls: {
          ordersUrl:
            parsedConfig.JUSPAY_BASE_URL + '/payout/merchant/v1/orders',
          statusUrl:
            parsedConfig.JUSPAY_BASE_URL + '/payout/merchant/v1/orders',
          webhookUrl:
            parsedConfig.REST_API_BASE_URL + `/payment/payout/juspay/webhook`,
        },
        fallbackName: 'ludo',
        merchantId: parsedConfig.JUSPAY_MERCHANT_ID,
        apiKey: parsedConfig.JUSPAY_PAYOUT_API_KEY,
        headers: {
          authorization: encodedPayoutApiKey,
          'x-merchantid': parsedConfig.JUSPAY_MERCHANT_ID,
          'Content-Type': 'application/json',
        },
      },
    },
  },
  notification: {
    host: parsedConfig.NOTIFICATION_SERVICE_HOST,
    port: parsedConfig.NOTIFICATION_SERVICE_PORT,
    msg91: {
      baseUrl: 'https://api.msg91.com/api/v5',
      templateIds: {
        global: {
          playstore: parsedConfig.MSG91_GLOBAL_PLAYSTORE_TEMPLATE_ID,
          website: parsedConfig.MSG91_GLOBAL_WEBSITE_TEMPLATE_ID,
        },
        local: {
          playstore: parsedConfig.MSG91_LOCAL_PLAYSTORE_TEMPLATE_ID,
          website: parsedConfig.MSG91_LOCAL_WEBSITE_TEMPLATE_ID,
        },
        downloadLink: parsedConfig.MSG91_DOWNLOAD_SMS_TEMPLATE_ID,
      },
      authKey: parsedConfig.MSG91_AUTH_KEY,
    },
    oneSignal: {
      appId: parsedConfig.ONE_SIGNAL_APP_ID,
      authToken: parsedConfig.ONE_SIGNAL_AUTH_TOKEN,
      baseUrl: parsedConfig.ONE_SIGNAL_BASE_URL,
    },
    appsflyer: {
      baseUrl: 'https://api2.appsflyer.com/inappevent',
      playstorePackageName: parsedConfig.PLAYSTORE_PACKAGE_NAME,
      proPackageName: parsedConfig.WEBSITE_PACKAGE_NAME,
      playstoreDevkey: parsedConfig.APPSFLYER_PLAYSTORE_DEV_KEY,
      proDevkey: parsedConfig.APPSFLYER_PRO_DEV_KEY,
    },
    deepLinks: {
      home: 'emp://Home',
      account: 'emp://Account',
      withdrawal: 'emp://Wallet/TransactionHistory/Withdrawals',
      deposit: 'emp://Wallet/TransactionHistory/Deposits',
    },
    customSounds: {
      tournament: {
        customChannelId:
          parsedConfig.LUDO_TOURNAMENT_CUSTOM_CHANNEL_ID as string,
        iosCustomSound: parsedConfig.LUDO_TOURNAMENT_IOS_SOUND_ID as string,
      },
      normal: {
        customChannelId: parsedConfig.NORMAL_PN_CUSTOM_CHANNEL_ID as string,
        iosCustomSound: parsedConfig.NORMAL_PN_IOS_SOUND_ID as string,
      },
    },
  },
  wallet: {
    port: parsedConfig.WALLET_SERVICE_PORT,
    host: parsedConfig.WALLET_SERVICE_HOST,
    bonusExpirationTime: 7,
  },
  socketGateway: {
    publicPort: parsedConfig.SOCKET_GATEWAY_PUBLIC_PORT,
    host: parsedConfig.SOCKET_GATEWAY_HOST,
    port: parsedConfig.SOCKET_GATEWAY_PORT,
    redisAdapter: {
      host: parsedConfig.REDIS_ADAPTER_HOST,
      port: parsedConfig.REDIS_ADAPTER_PORT,
    },
    broadcastOnlineUserCountCronExpr: '*/10 * * * * *',
  },
  spGameplay: {
    host: parsedConfig.SP_GAMEPLAY_SERVICE_HOST,
    port: parsedConfig.SP_GAMEPLAY_SERVICE_PORT,
    publicPort: parsedConfig.SP_GAMEPLAY_SERVICE_PUBLIC_PORT,
    playerPrefix: 'PL',
    gameTypes: [
      {
        type: 'multiplayer',
        noPlayers: 6,
        winAmountPercentage: 90,
        matchingTimeout: 60,
        targetPawnCount: 4,
      },
      {
        type: 'twoPlayer',
        noPlayers: 2,
        winAmountPercentage: 90,
        matchingTimeout: 60,
        targetPawnCount: 2,
      },
    ],
    turnTimeout: 20,
    startTimeout: 3,
    initialBetTimeout: 3,
    sideshowTimeout: 5,
    roundEndDelay: 3,
    rebuyTimeout: 20,
    gameEndDelay: 3,
    rebuyDelay: 5,
    revealCardDelay: 3,
    decideWinnerTimeout: 7,
    redis: {
      host: parsedConfig.SP_REDIS_HOST,
      port: parsedConfig.SP_REDIS_PORT,
      isClustered: false,
      tlsEnabled: parsedConfig.NODE_ENV !== Environment.development,
      keyPrefixes: {
        activeTableKey: '{spTable}',
        processStatus: {
          deleted: 'deleted',
          created: 'created',
        },
        userActiveTableKey: '{spUserActiveTable}',
        tableQueueLock: '{spTableQueueLock}',
        configKey: '{spConfig}',
        tableQueuePid: '{spTableQueuePid}',
        queueLockKey: '{spQueueLock}',
        userSocketKey: '{spUserSocket}',
        userCountKey: '{spUserCount}',
        waitingTableLockKey: '{spWaitingTableLock}',
        waitingTableKey: '{spWaitingTable}',
        userWaitingTableKey: '{spUserWaitingTable}',
        userLockKey: '{spUserLock}',
        tableLockKey: '{spTableLock}',
        blockedUserKey: '{blockedUser}',
        stuckTableId: '{spStuckTableId}',
        tablePrefix: '{spTable}',
        bigTableKey: '{bigTable}',
      },
    },
    playerOrder: ['PL1', 'PL2', 'PL3', 'PL4', 'PL5', 'PL6'],
    schedulingIntervalInMs: 3000,
    tableQueueIntervalInMs: 100,
    getConfigIntervalInMs: 5000,
    alphaNumberics:
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  },
  reGameplay: {
    host: parsedConfig.RE_GAMEPLAY_SERVICE_HOST,
    port: parsedConfig.RE_GAMEPLAY_SERVICE_PORT,
    publicPort: parsedConfig.RE_GAMEPLAY_SERVICE_PUBLIC_PORT,
    playerPrefix: 'PL',
    gameTypes: [
      {
        type: 'multiplayer',
        noPlayers: 6,
        winAmountPercentage: 90,
        matchingTimeout: 60,
      },
      {
        type: 'twoPlayer',
        noPlayers: 2,
        winAmountPercentage: 90,
        matchingTimeout: 60,
      },
    ],
    startTimeout: 10,
    dealCardsTimeout: 3,
    turnTimeout: 60,
    nextTimeout: 0.5,
    initialBetTimeout: 3,
    sideshowTimeout: 5,
    finishDeclarationTimeout: 30,
    roundEndDelay: 3,
    rebuyTimeout: 20,
    gameEndDelay: 10,
    rebuyDelay: 5,
    revealCardDelay: 3,
    decideWinnerTimeout: 7,
    redis: {
      host: parsedConfig.RE_REDIS_HOST,
      port: parsedConfig.RE_REDIS_PORT,
      isClustered: false,
      tlsEnabled: parsedConfig.NODE_ENV !== Environment.development,
      keyPrefixes: {
        matchingNoKey: '{matchingNoKey}',
        activeTableKey: '{reTable}',
        processStatus: {
          deleted: 'deleted',
          created: 'created',
        },
        userActiveTableKey: '{reUserActiveTable}',
        tableQueueLock: '{reTableQueueLock}',
        configKey: '{reConfig}',
        tableQueuePid: '{reTableQueuePid}',
        queueLockKey: '{reQueueLock}',
        userSocketKey: '{reUserSocket}',
        userCountKey: '{reUserCount}',
        waitingTableLockKey: '{reWaitingTableLock}',
        waitingTableKey: '{reWaitingTable}',
        userWaitingTableKey: '{reUserWaitingTable}',
        userLockKey: '{reUserLock}',
        tableLockKey: '{reTableLock}',
        blockedUserKey: '{blockedUser}',
        stuckTableId: '{reStuckTableId}',
        tablePrefix: '{reTable}',
      },
    },
    playerOrder: ['PL1', 'PL2', 'PL3', 'PL4', 'PL5', 'PL6'],
    schedulingIntervalInMs: 3000,
    tableQueueIntervalInMs: 100,
    getConfigIntervalInMs: 5000,
    alphaNumberics:
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  },
  redis: {
    keyPrefixes: {
      lockKey: '{lockKey}',
    },
    adapter: {
      host: parsedConfig.REDIS_ADAPTER_HOST,
      port: parsedConfig.REDIS_ADAPTER_PORT,
      isClustered: parsedConfig.REDIS_ADAPTER_IS_CLUSTERED,
    },
  },
  cbrGameplay: {
    host: parsedConfig.CBR_GAMEPLAY_SERVICE_HOST,
    port: parsedConfig.CBR_GAMEPLAY_SERVICE_PORT,
    publicPort: parsedConfig.CBR_GAMEPLAY_SERVICE_PUBLIC_PORT,
    redis: {
      host: parsedConfig.CBR_REDIS_HOST,
      port: parsedConfig.CBR_REDIS_PORT,
      isClustered: parsedConfig.CBR_REDIS_IS_CLUSTERED,
      tlsEnabled: parsedConfig.CBR_REDIS_TLS_ENABLED,
      tablePrefix: parsedConfig.CBR_TABLE_PREFIX,
      waitingTableKey: '{waitingTable}',
      activeTableKey: '{table}',
      userSocketKey: '{userSocket}',
      userActiveTableKey: '{userActiveTable}',
      userWaitingTableKey: '{userWaitingTable}',
      userLockKey: '{userLock}',
      queueLockKey: '{queueLock}',
      tableLockKey: '{tableLock}',
      waitingTableLockKey: '{waitingTableLock}',
      tableQueueLock: '{tableQueueLock}',
      tableQueuePid: '{tableQueuePid}',
      blockedUserKey: '{blockedUser}',
      stuckTableId: '{stuckTableId}',
      configKey: '{config}',
      bigTableKey: '{bigTable}',
      processStatus: {
        deleted: 'deleted',
        created: 'created',
      },
      tableExpirationSeconds: 67.5 * 60,
    },
    timeout: {
      turnTimeout: 2,
      dealTimeout: 5,
      handBidTimeout: 2,
      endHandTimeout: 2,
      actionTimeout: 12,
      autoTimeout: 1,
      roundEndTimeout: 5,
      matchingTimeout: 60,
      startTimeout: 5,
      gameEndDelay: 3,
    },
    alphaNumberics:
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  },
  ludoGameplay: {
    host: parsedConfig.LUDO_GAMEPLAY_SERVICE_HOST,
    port: parsedConfig.LUDO_GAMEPLAY_SERVICE_PORT,
    publicPort: parsedConfig.LUDO_GAMEPLAY_SERVICE_PUBLIC_PORT,
    redis: {
      host: parsedConfig.LUDO_REDIS_HOST,
      port: parsedConfig.LUDO_REDIS_PORT,
      isClustered: parsedConfig.LUDO_REDIS_IS_CLUSTERED,
      isTlsEnabled: parsedConfig.LUDO_REDIS_IS_TLS_ENABLED,
      waitingTableKey: '{waitingTable}',
      activeTableKey: '{table}',
      userActiveTableKey: '{userActiveTable}',
      userWaitingTableKey: '{userWaitingTable}',
      userTournamentKey: '{userTournament}',
      blockedUserKey: '{blockedUser}',
      userNotMatchedKey: '{userNotMatched}',
      promotedUserKey: '{promotedUser}',
      discardedUserKey: '{discardedUser}',
      bigTableKey: '{bigTable}',
    },
    initialPawnPositions: {
      quick: ['1', '27', '14', '40'],
      classic: ['1', '27', '14', '40'],
      // classic: ['B100', 'B200', 'B300', 'B400'],
      furious4: ['1', '27', '14', '40'],
      tournament: ['1', '27', '14', '40'],
    },
    turnTime: 12,
    startTimeout: 15,
    tournamentRoundWaitingTime: 30, // tournament starts 30 seconds after matching
    bingoScreenWaitingTime: 10, // tournament starts 10s after bingo screen
    movePawnDelay: 1.3,
    initialLives: 3,
    schedulingIntervalInMs: 500,
    pawnPositionPrefix: 'PW',
    playerPrefix: 'PL',
    protectedCells: ['1', '9', '27', '35', '14', '22', '40', '48'],
    movePawnPaths: {
      PL1: [
        'B100',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '15',
        '16',
        '17',
        '18',
        '19',
        '20',
        '21',
        '22',
        '23',
        '24',
        '25',
        '26',
        '27',
        '28',
        '29',
        '30',
        '31',
        '32',
        '33',
        '34',
        '35',
        '36',
        '37',
        '38',
        '39',
        '40',
        '41',
        '42',
        '43',
        '44',
        '45',
        '46',
        '47',
        '48',
        '49',
        '50',
        '51',
        'H101',
        'H102',
        'H103',
        'H104',
        'H105',
        'Home',
      ],
      PL2: [
        'B200',
        '27',
        '28',
        '29',
        '30',
        '31',
        '32',
        '33',
        '34',
        '35',
        '36',
        '37',
        '38',
        '39',
        '40',
        '41',
        '42',
        '43',
        '44',
        '45',
        '46',
        '47',
        '48',
        '49',
        '50',
        '51',
        '52',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '15',
        '16',
        '17',
        '18',
        '19',
        '20',
        '21',
        '22',
        '23',
        '24',
        '25',
        'H201',
        'H202',
        'H203',
        'H204',
        'H205',
        'Home',
      ],
      PL3: [
        'B300',
        '14',
        '15',
        '16',
        '17',
        '18',
        '19',
        '20',
        '21',
        '22',
        '23',
        '24',
        '25',
        '26',
        '27',
        '28',
        '29',
        '30',
        '31',
        '32',
        '33',
        '34',
        '35',
        '36',
        '37',
        '38',
        '39',
        '40',
        '41',
        '42',
        '43',
        '44',
        '45',
        '46',
        '47',
        '48',
        '49',
        '50',
        '51',
        '52',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
        'H301',
        'H302',
        'H303',
        'H304',
        'H305',
        'Home',
      ],
      PL4: [
        'B400',
        '40',
        '41',
        '42',
        '43',
        '44',
        '45',
        '46',
        '47',
        '48',
        '49',
        '50',
        '51',
        '52',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '15',
        '16',
        '17',
        '18',
        '19',
        '20',
        '21',
        '22',
        '23',
        '24',
        '25',
        '26',
        '27',
        '28',
        '29',
        '30',
        '31',
        '32',
        '33',
        '34',
        '35',
        '36',
        '37',
        '38',
        'H401',
        'H402',
        'H403',
        'H404',
        'H405',
        'Home',
      ],
    },
    playerOrder: {
      PL1: 'PL3',
      PL2: 'PL4',
      PL3: 'PL2',
      PL4: 'PL1',
    },
    defaultTargetPawns: {
      twoPlayer: {
        quick: 2,
        classic: 4,
      },
      fourPlayer: {
        quick: 1,
        classic: 4,
      },
    },
  },
  ludoTournament: {
    host: parsedConfig.LUDO_TOURNAMENT_SERVICE_HOST,
    port: parsedConfig.LUDO_TOURNAMENT_SERVICE_PORT,
    notificationsBefore: [
      {
        time: 10,
        unit: 'minutes',
        pushNotification: {
          enabled: true,
          useSound: false,
        },
        socketEvent: true,
      },
      {
        time: 5,
        unit: 'minutes',
        pushNotification: {
          enabled: true,
          useSound: true,
        },
        socketEvent: true,
      },
      {
        time: 1,
        unit: 'minutes',
        pushNotification: {
          enabled: true,
          useSound: true,
        },
        socketEvent: true,
      },
    ],
    roundDurations: [
      {
        noPlayers: 2,
        duration: parsedConfig.NODE_ENV === Environment.production ? 5 : 2,
        unit: 'minutes',
      },
      {
        noPlayers: 3,
        duration: parsedConfig.NODE_ENV === Environment.production ? 7 : 3,
        unit: 'minutes',
      },
      {
        noPlayers: 4,
        duration: parsedConfig.NODE_ENV === Environment.production ? 10 : 4,
        unit: 'minutes',
      },
    ],
    repeatDuration: {
      commonTime: 5, //Repeat After 5 min.
      startTime: 1,
    },
    autoRepeatDuration: {
      commonTime: 5,
      startTime: 1,
    },
    firebase: {
      appId: parsedConfig.FIREBASE_APP_ID,
      firebaseApiEndpoint:
        'https://firebasedynamiclinks.googleapis.com/v1/shortLinks',
      domainUriPrefix: 'https://capermint.page.link',
      packageName: 'com.capermint.ludoempire',
    },
  },
  ludoMegaTournament: {
    host: parsedConfig.LUDO_MEGA_TOURNAMENT_SERVICE_HOST,
    port: parsedConfig.LUDO_MEGA_TOURNAMENT_SERVICE_PORT,
    publicPort: parsedConfig.LUDO_MEGA_TOURNAMENT_SERVICE_PUBLIC_PORT,
    redis: {
      host: parsedConfig.LUDO_MEGA_TOURNAMENT_REDIS_HOST,
      port: parsedConfig.LUDO_MEGA_TOURNAMENT_REDIS_PORT,
      isClustered: parsedConfig.LUDO_MEGA_TOURNAMENT_REDIS_IS_CLUSTERED,
      isTlsEnabled: parsedConfig.LUDO_MEGA_TOURNAMENT_REDIS_IS_TLS_ENABLED,
    },
  },
  slGameplay: {
    host: parsedConfig.SL_GAMEPLAY_SERVICE_HOST,
    port: parsedConfig.SL_GAMEPLAY_SERVICE_PORT,
    publicPort: parsedConfig.SL_GAMEPLAY_SERVICE_PUBLIC_PORT,
    redis: {
      host: parsedConfig.SL_GAMEPLAY_REDIS_HOST,
      port: parsedConfig.SL_GAMEPLAY_REDIS_PORT,
      isClustered: parsedConfig.SL_GAMEPLAY_REDIS_IS_CLUSTERED,
      isTlsEnabled: parsedConfig.SL_GAMEPLAY_REDIS_TLS_ENABLED,
      waitingTableKey: '{waitingTable}',
      activeTableKey: '{table}',
      userActiveTableKey: '{userActiveTable}',
      userWaitingTableKey: '{userWaitingTable}',
      userTournamentKey: '{userTournament}',
      blockedUserKey: '{blockedUser}',
      userNotMatchedKey: '{userNotMatched}',
      promotedUserKey: '{promotedUser}',
      discardedUserKey: '{discardedUser}',
    },
    timeout: {
      turnTimeout: 2,
      dealTimeout: 5,
      handBidTimeout: 2,
      endHandTimeout: 2,
      actionTimeout: 12,
      autoTimeout: 1,
      roundEndTimeout: 5,
      matchingTimeout: 60,
      startTimeout: 5,
      gameEndDelay: 3,
    },
    alphaNumberics:
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  },
  eplGameplay: {
    host: parsedConfig.EPL_GAMEPLAY_SERVICE_HOST,
    port: parsedConfig.EPL_GAMEPLAY_SERVICE_PORT,
    publicPort: parsedConfig.EPL_GAMEPLAY_SERVICE_PUBLIC_PORT,
    redis: {
      host: parsedConfig.EPL_GAMEPLAY_REDIS_HOST,
      port: parsedConfig.EPL_GAMEPLAY_REDIS_PORT,
      isClustered: parsedConfig.EPL_GAMEPLAY_REDIS_IS_CLUSTERED,
      isTlsEnabled: parsedConfig.EPL_GAMEPLAY_REDIS_TLS_ENABLED,
    },
  },
  aviator: {
    host: parsedConfig.AVIATOR_GAMEPLAY_SERVICE_HOST,
    port: parsedConfig.AVIATOR_GAMEPLAY_SERVICE_PORT,
    publicPort: parsedConfig.AVIATOR_GAMEPLAY_SERVICE_PUBLIC_PORT,
    redis: {
      host: parsedConfig.AVIATOR_REDIS_HOST,
      port: parsedConfig.AVIATOR_REDIS_PORT,
      isClustered: parsedConfig.AVIATOR_REDIS_IS_CLUSTERED,
      isTlsEnabled: parsedConfig.AVIATOR_REDIS_IS_TLS_ENABLED,
    },
  },
  scheduler: {
    host: parsedConfig.SCHEDULER_SERVICE_HOST,
    port: parsedConfig.SCHEDULER_SERVICE_PORT,
    leaderboard: {
      day: '0 0 * * *',
      week: '20 0 * * *',
      month: '40 0 * * *',
    },
    oldUserPN: {
      time: '0 13 * * 0',
      hours: 24,
      messages: [
        {
          title: 'Sab theek hai? Kahan hain aap? 🤔',
          content: 'Jaldi aake milo, ek game ho jaye! ⭐ Tap here! 👍',
        },
        {
          title: 'Oh ho! Kya bhool gye hume? 🙋‍♀️',
          content: 'Humare darvaje khule hain 🙌 Aao aur khelo aaj hi! ⭐',
        },
        {
          title: 'Aaj ki jeet ho sakti hai aapke naam 🏆',
          content: 'Mauka mat gavao Skill Patti table par aao ♠',
        },
        {
          title: 'Ludo board hai tayyar 🎲',
          content: 'Bas aap hi ki kami hai 👁 Tap to play now! 😄',
        },
        {
          title: 'Aur intezaar mat karo 👁',
          content: 'Callbreak par aao aur play now ♠',
        },
        {
          title: 'Kya aapne humare player ko dekha hai? 💁‍♀️',
          content:
            'Kahin mile to bhej deejiye ga ✌ hum intezaar kar rahein hai! 👀',
        },
        {
          title: 'Samay ho raha hai 🕰 game aapka wait kar raha hai 🚩',
          content:
            'Empire Games ki train 🚂 chadhein aur khelkar paise kamaein 💰',
        },
        {
          title: 'Kab aana hoga? 🔔',
          content: 'Pata bhej diya hai humne - Tap here! 👑',
        },
      ],
      deepLink: 'emp://Home',
    },
  },
  gameHistory: {
    leaderboard: {
      maxEntries: 100_000,
    },
  },
  jest: {
    mainConfig: {
      underMaintenance: false,
      restrictedStates: [],
      games: [],
      commissions: {
        bonusCommission: '5',
        referralCommission: '2',
        discrepancyCommission: '1',
        conversionCommission: '5',
      },
      bonuses: {
        referralBonus: '2',
        signupBonus: {
          main: '9',
          win: '0',
          bonus: '41',
        },
      },
      payments: {
        depositGateway: Gateway.cashfree,
        withdrawGateway: Gateway.cashfree,
        isGstDeductionEnabled: true,
        isGstCashbackEnabled: false,
        isTaxDeductionEnabled: true,
        isTaxCashbackEnabled: true,
        isNameVerificationEnabled: true,
        accountVerificationCharges: '1',
      },
      limits: {
        autoTransferLimit: '10000',
        upiWithdrawalLimit: '1',
        bankWithdrawalLimit: '1',
        kycWithdrawalLimit: '1000',
        maxWithdrawalsPerDay: '10',
        kycLimitPerDocument: '10000',
        taxFreeWithdrawalLimit: '5',
      },
      freeGames: {
        allowedGamesPerDay: 2,
        winningsToPro: '10',
        upiWithdrawalLimit: '1',
        bankWithdrawalLimit: '1',
        maxLifetimeWithdrawalLimit: '10',
        maxWithdrawalsPerDay: '5',
      },
    },
    testAssestsFolder: './assets/test-files/',
  },
  maintenance: {
    bypassKey: parsedConfig.MAINTENANCE_BYPASS_KEY,
  },
};

const serviceMapping: Partial<Record<App, ServiceInfo>> = {
  [App.auth]: {
    name: TransporterProviders.AUTH_SERVICE,
    config: {
      host: config.auth.host,
      port: config.auth.port,
    },
    clients: [App.restApi],
  },
  [App.user]: {
    name: TransporterProviders.USER_SERVICE,
    config: {
      host: config.user.host,
      port: config.user.port,
    },
    clients: [
      App.restApi,
      App.auth,
      App.payment,
      App.reGameplay,
      App.spGameplay,
      App.cbrGameplay,
      App.ludoTournament,
      App.aviator,
    ],
  },
  [App.gameRecord]: {
    name: TransporterProviders.RECORD_SERVICE,
    config: {
      host: config.record.host,
      port: config.record.port,
    },
    clients: [App.restApi, App.scheduler],
  },
  [App.notification]: {
    name: TransporterProviders.NOTIFICATION_SERVICE,
    config: {
      host: config.notification.host,
      port: config.notification.port,
    },
    clients: [
      App.auth,
      App.scheduler,
      App.payment,
      App.user,
      App.ludoGameplay,
      App.spGameplay,
      App.cbrGameplay,
      App.ludoMegaTournament,
      App.slGameplay,
    ],
  },
  [App.payment]: {
    name: TransporterProviders.PAYMENT_SERVICE,
    config: {
      host: config.payment.host,
      port: config.payment.port,
    },
    clients: [App.restApi, App.auth],
  },
  [App.wallet]: {
    name: TransporterProviders.WALLET_SERVICE,
    config: {
      host: config.wallet.host,
      port: config.wallet.port,
    },
    clients: [
      App.restApi,
      App.payment,
      App.user,
      App.reGameplay,
      App.spGameplay,
      App.cbrGameplay,
      App.ludoGameplay,
      App.ludoTournament,
      App.ludoMegaTournament,
      App.slGameplay,
      App.aviator,
      App.eplGameplay,
    ],
  },
  [App.spGameplay]: {
    name: TransporterProviders.SP_GAMEPLAY_SERVICE,
    config: {
      host: config.spGameplay.host,
      port: config.spGameplay.port,
    },
    clients: [App.socketGateway, App.scheduler, App.restApi],
  },
  [App.eplGameplay]: {
    name: TransporterProviders.EPL_GAMEPLAY_SERVICE,
    config: {
      host: config.eplGameplay.host,
      port: config.eplGameplay.port,
    },
    clients: [App.socketGateway, App.scheduler, App.restApi],
  },
  [App.reGameplay]: {
    name: TransporterProviders.RE_GAMEPLAY_SERVICE,
    config: {
      host: config.reGameplay.host,
      port: config.reGameplay.port,
    },
    clients: [App.socketGateway, App.scheduler, App.restApi],
  },
  [App.scheduler]: {
    name: TransporterProviders.SCHEDULER_SERVICE,
    config: {
      host: config.scheduler.host,
      port: config.scheduler.port,
    },
    clients: [
      App.socketGateway,
      App.ludoGameplay,
      App.ludoTournament,
      App.notification,
    ],
  },
  [App.socketGateway]: {
    name: TransporterProviders.SOCKET_GATEWAY_SERVICE,
    config: {
      host: config.socketGateway.host,
      port: config.socketGateway.port,
    },
    clients: [
      App.scheduler,
      App.reGameplay,
      App.spGameplay,
      App.cbrGameplay,
      App.notification,
      App.ludoGameplay,
      App.cbrGameplay,
      App.slGameplay,
    ],
  },
  [App.promo]: {
    name: TransporterProviders.PROMO_SERVICE,
    config: {
      host: config.promo.host,
      port: config.promo.port,
    },
    clients: [App.restApi],
  },
  [App.cbrGameplay]: {
    name: TransporterProviders.CBR_GAMEPLAY_SERVICE,
    config: {
      host: config.cbrGameplay.host,
      port: config.cbrGameplay.port,
    },
    clients: [App.socketGateway, App.scheduler, App.restApi],
  },
  [App.ludoGameplay]: {
    name: TransporterProviders.LUDO_GAMEPLAY_SERVICE,
    config: {
      host: config.ludoGameplay.host,
      port: config.ludoGameplay.port,
    },
    clients: [App.socketGateway, App.scheduler, App.ludoTournament],
  },
  [App.ludoTournament]: {
    name: TransporterProviders.LUDO_TOURNAMENT_SERVICE,
    config: {
      host: config.ludoTournament.host,
      port: config.ludoTournament.port,
    },
    clients: [App.ludoGameplay, App.restApi, App.scheduler],
  },
  [App.ludoMegaTournament]: {
    name: TransporterProviders.LUDO_MEGA_TOURNAMENT_SERVICE,
    config: {
      host: config.ludoMegaTournament.host,
      port: config.ludoMegaTournament.port,
    },
    clients: [App.scheduler, App.restApi, App.socketGateway],
  },
  [App.slGameplay]: {
    name: TransporterProviders.SL_GAMEPLAY_SERVICE,
    config: {
      host: config.slGameplay.host,
      port: config.slGameplay.port,
    },
    clients: [App.scheduler, App.restApi, App.socketGateway],
  },
  [App.aviator]: {
    name: TransporterProviders.AVIATOR_GAMEPLAY_SERVICE,
    config: {
      host: config.aviator.host,
      port: config.aviator.port,
    },
    clients: [App.scheduler, App.restApi, App.socketGateway],
  },
};

export function getServiceConfig(appName: App): ServiceConfig {
  const serverConfig = serviceMapping[appName]?.config;
  if (!serverConfig) {
    const errorMessage = `Can not find server config for ${appName}`;
    logger.fatal(errorMessage);
    throw new InternalServerErrorException(errorMessage);
  }
  let { port } = serverConfig;
  const host = '0.0.0.0';
  if (config.isJest) {
    port = Number(port) + 10_000;
  }
  return { host, port };
}

export function getServicesInfoToConnect(
  appName: App,
): ClientProviderOptions[] {
  const connectionInfo: ClientProviderOptions[] = [];
  const services = Object.values(serviceMapping);
  for (const service of services) {
    let { host, port } = service.config;
    const { name, clients } = service;
    if (config.isJest) {
      host = 'localhost';
      port = Number(port) + 10_000;
    }
    if (clients.includes(appName)) {
      connectionInfo.push({
        name,
        transport: Transport.TCP,
        options: {
          host,
          port,
        },
      });
    }
  }
  return connectionInfo;
}
